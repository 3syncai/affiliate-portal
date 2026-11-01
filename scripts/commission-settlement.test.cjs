/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL regression tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
require('./register-portal-ts');
const { voidApprovedReturnCommissions } = require('../lib/void-return-commission.ts');
const { syncAffiliateCommissionStatuses: settle } = require('../lib/affiliate-commission-sync.ts');
const root = path.resolve(__dirname, '..');
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55439' || parsed.pathname !== '/postgres') {
    throw new Error('Only disposable localhost:55439/postgres is permitted');
  }
}
const migration = fs.readFileSync(path.join(root, 'migrations/add_commission_wallet_ledger.sql'), 'utf8');
test('request handlers never invoke settlement or direct credit bypasses', () => {
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  }
  for (const file of walk(path.join(root, 'app/api')).filter(f => f.endsWith('/route.ts') || f.endsWith('\\route.ts'))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /syncAffiliateCommissionStatuses|syncDeliveredCommissions/, file);
  }
});
test('wallet GET performs only SELECTs and preserves response contract', async () => {
  const ts = require('typescript');
  const exports = {};
  const statements = [];
  const db = { query: async sql => {
    statements.push(sql); assert.match(sql.trim(), /^SELECT\b/i);
    if (sql.includes('FROM affiliate_user')) return { rows: [{ id: 'agent', first_name: 'QA', last_name: 'Agent', refer_code: 'QA' }] };
    if (sql.includes('commission_rates')) return { rows: [{ commission_percentage: 50 }] };
    if (sql.includes('affiliate_commission_log')) return { rows: [{ total_earned: '20' }] };
    return { rows: [{ paid_out: '5', total_deducted: '5', total_tds_deducted: '0' }] };
  } };
  const source = fs.readFileSync(path.join(root, 'app/api/affiliate/wallet/route.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText,
    { exports, require: key => key === '@/lib/db' ? { __esModule: true, default: db } : { NextResponse: { json: body => body } }, URL, console });
  const response = await exports.GET({ url: 'http://localhost/api/affiliate/wallet?refer_code=QA' });
  assert.equal(response.success, true); assert.equal(response.data.balance.current, 15); assert.equal(statements.length, 4);
});

test('status webhook preserves settled entries and pending bonus calculation', async () => {
  const ts = require('typescript');
  function load(file, modules) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, { exports, require: name => modules[name], console });
    return exports;
  }
  const updates = [];
  const db = { query: async (sql, args) => {
    if (sql.includes('FROM affiliate_commission_log')) {
      assert.match(sql, /status = 'PENDING'/);
      return { rows: [{ id: 'p', product_id: 'prod', order_amount: '100', commission_source: 'affiliate',
        affiliate_code: 'QA', commission_amount: '20', affiliate_rate: '50' }] };
    }
    if (sql.includes('FROM additional_commissions')) return { rows: [{ id: 1, additional_rate: '2' }] };
    assert.match(sql, /WHERE id = \$1 AND status = 'PENDING'/);
    updates.push(args); return { rows: [], rowCount: 1 };
  } };
  const bonus = load('lib/additional-commission.ts', { '@/lib/db': { __esModule: true, default: db } });
  await bonus.applyAdditionalCommissionForOrder('order', db, true);
  assert.equal(updates[0][4], 12, 'existing pending payout = 20 * 50% + 100 * 2%');
  let writes = 0;
  const route = load('app/api/webhook/commission/update-status/route.ts', {
    'next/server': { NextResponse: { json: body => body } },
    '@/lib/db': { __esModule: true, default: { query: async sql => {
      writes++; assert.match(sql, /AND status = 'PENDING'/);
      assert.doesNotMatch(sql, /status NOT IN/); return { rows: [], rowCount: 0 };
    } } },
    '@/lib/additional-commission': { applyAdditionalCommissionForOrder: async () => {} },
  });
  const response = await route.POST({ json: async () => ({ order_id: 'order', status: 'CREDITED' }) });
  assert.equal(response.success, true); assert.equal(response.updated_count, 0); assert.equal(writes, 1);
});

test('real PostgreSQL settlement, concurrency and recovery', { skip: !url }, async t => {
  const admin = new Pool({ connectionString: url });
  const database = 'qa_partner_settlement_' + crypto.randomBytes(6).toString('hex');
  let pool;
  const options = { logPrefix: '[Settlement Test]', throwOnError: true };
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    const scoped = new URL(url); scoped.pathname = '/' + database;
    pool = new Pool({ connectionString: scoped.toString(), max: 6 });
    await pool.query(`CREATE TABLE affiliate_user (id text PRIMARY KEY, refer_code text UNIQUE, branch text, approved_by text, entry_sponsor text);
      CREATE TABLE customer_wallet (customer_id text PRIMARY KEY, coins_balance numeric DEFAULT 0);
      CREATE TABLE "order" (id text PRIMARY KEY, status text, metadata jsonb, canceled_at timestamptz);
      CREATE TABLE return_request (id text PRIMARY KEY, order_id text, status text, deleted_at timestamptz);
      CREATE TABLE affiliate_commission_log (id text PRIMARY KEY, order_id text, affiliate_code text,
        affiliate_user_id text, commission_source text DEFAULT 'affiliate', affiliate_commission numeric,
        additional_commission_amount numeric DEFAULT 0, status text, unlock_at timestamptz,
        credited_at timestamptz, created_at timestamptz DEFAULT now(), product_name text, quantity int,
        item_price numeric, order_amount numeric, commission_rate numeric, commission_amount numeric,
        customer_id text, customer_name text, customer_email text, product_id text, category_id text, collection_id text);
      INSERT INTO affiliate_user(id, refer_code) VALUES ('agent', 'QA');
      INSERT INTO "order" VALUES ('order', 'completed', '{"shiprocket_delivered_at":"2026-01-01T00:00:00Z"}', NULL);
      INSERT INTO affiliate_commission_log(id,order_id,affiliate_code,status,affiliate_commission) VALUES ('legacy','order','QA','CREDITED',75);
      INSERT INTO customer_wallet VALUES ('agent',75);`);
    const reset = async () => {
      await pool.query(`TRUNCATE affiliate_commission_log, partner_commission_wallet_ledger, customer_wallet, return_request;
        UPDATE "order" SET status='completed', canceled_at=NULL;
        INSERT INTO customer_wallet VALUES ('agent',0);`);
    };
    const insert = async (id, amount = '10.25', extra = {}) => {
      await pool.query(`INSERT INTO affiliate_commission_log
        (id,order_id,affiliate_code,affiliate_user_id,commission_source,status,affiliate_commission,unlock_at)
        VALUES($1,'order',$2,$3,$4,$5,$6::numeric,$7::timestamptz)`,
        [id, extra.code || 'QA', extra.user || null, extra.source || 'affiliate', extra.status || 'PENDING', amount,
          extra.unlock === undefined ? '2026-01-01T00:00:00Z' : extra.unlock]);
    };
    const balance = async id => (await pool.query('SELECT coins_balance::text AS value FROM customer_wallet WHERE customer_id=$1', [id || 'agent'])).rows[0]?.value;
    const status = async id => (await pool.query('SELECT status FROM affiliate_commission_log WHERE id=$1', [id])).rows[0].status;
    await t.test('migration baselines historical credits without incrementing balances, and reruns safely', async () => {
      await pool.query(migration); await pool.query(migration);
      assert.equal(await balance(), '75');
      assert.equal((await pool.query('SELECT legacy_baseline FROM partner_commission_wallet_ledger')).rows[0].legacy_baseline, true);
      await pool.query(fs.readFileSync(path.join(root, 'migrations/update_commission_unlock_trigger_7d.sql'), 'utf8'));
      await settle(pool, options); assert.equal(await balance(), '75');
    });
    await t.test('credits without opening any page; repeat and new worker instance cannot duplicate', async () => {
      await reset(); await insert('one'); await settle(pool, options); await settle(pool, options);
      const fresh = new Pool({ connectionString: scoped.toString() });
      try { await settle(fresh, options); } finally { await fresh.end(); }
      assert.equal(await balance(), '10.25'); assert.equal(await status('one'), 'CREDITED');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM partner_commission_wallet_ledger')).rows[0].n, 1);
    });
    await t.test('concurrent workers make exactly one credit', async () => {
      await reset(); await insert('concurrent');
      await Promise.all(Array.from({ length: 4 }, () => settle(pool, options)));
      await settle(pool, options); assert.equal(await balance(), '10.25');
    });
    await t.test('failure after receipt and wallet update rolls back everything; retry succeeds', async () => {
      await reset(); await insert('fail');
      const faulty = { connect: async () => {
        const c = await pool.connect(); return { release: () => c.release(), query: (sql, args) => {
          if (sql.includes("SET status = 'CREDITED'")) throw Error('Injected promotion failure');
          return c.query(sql, args);
        } };
      } };
      await assert.rejects(settle(faulty, options), /Injected promotion failure/);
      assert.equal(await balance(), '0'); assert.equal(await status('fail'), 'PENDING');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM partner_commission_wallet_ledger')).rows[0].n, 0);
      await settle(pool, options); assert.equal(await balance(), '10.25');
    });
    await t.test('process death before COMMIT leaves no credit; worker restart retries safely', async () => {
      await reset(); await insert('crash');
      const child = spawnSync(process.execPath, ['-e', `
        require('./scripts/register-portal-ts'); const {Pool}=require('pg');
        const {syncAffiliateCommissionStatuses}=require('./lib/affiliate-commission-sync.ts');
        const p=new Pool({connectionString:process.env.QA_DATABASE_URL});
        const wrapped={connect:async()=>{const c=await p.connect();return {release:()=>c.release(),query:(sql,args)=>{
          if(sql==='COMMIT')process.exit(17);return c.query(sql,args);
        }}}};
        syncAffiliateCommissionStatuses(wrapped,{logPrefix:'QA crash',throwOnError:true}).catch(()=>process.exit(18));
      `], { cwd: root, env: { ...process.env, QA_DATABASE_URL: scoped.toString() }, timeout: 15000, encoding: 'utf8' });
      assert.equal(child.status, 17, child.stderr);
      assert.equal(await balance(), '0'); assert.equal(await status('crash'), 'PENDING');
      await settle(pool, options); assert.equal(await balance(), '10.25');
    });
    await t.test('all existing role sources keep their correct recipient and exact numeric amounts', async () => {
      await reset();
      const roles = ['branch_admin','area_manager','asm_direct','state_admin','state_admin_direct'];
      for (const role of roles) await insert(role, '0.10', { source: role, user: role, code: 'NON_AFFILIATE' });
      await insert('se_a', '0.10'); await insert('se_b', '0.20'); await settle(pool, options);
      assert.equal(await balance(), '0.30');
      for (const role of roles) assert.equal(await balance(role), '0.10');
    });
    await t.test('future unlock, missing rate and missing recipient remain uncredited', async () => {
      await reset();
      await insert('future', '10', { unlock: '2999-01-01' });
      await insert('rate', '10', { status: 'RATE_MISSING' });
      await insert('missing', '10', { code: 'MISSING' });
      await settle(pool, options);
      assert.equal(await balance(), '0'); assert.equal(await status('future'), 'PENDING');
      assert.equal(await status('rate'), 'RATE_MISSING'); assert.equal(await status('missing'), 'PENDING');
    });
    await t.test('delivery arms the existing return window; undelivered order never arms it', async () => {
      await reset(); await insert('arm', '10', { unlock: null }); await settle(pool, options);
      const unlock = (await pool.query("SELECT unlock_at FROM affiliate_commission_log WHERE id='arm'")).rows[0].unlock_at;
      assert.equal(new Date(unlock).toISOString(), '2026-01-08T00:00:00.000Z');
      await reset(); await pool.query(`UPDATE "order" SET status='pending', metadata='{}'`);
      await insert('unshipped', '10', { unlock: null }); await settle(pool, options);
      assert.equal(await status('unshipped'), 'PENDING'); assert.equal(await balance(), '0');
      await pool.query(`UPDATE "order" SET metadata='{"shiprocket_delivered_at":"2026-01-01T00:00:00Z"}'`);
    });
    await t.test('pending return holds credit, rejected return releases it, approved return reverses once', async () => {
      await reset(); await insert('returned');
      await pool.query("INSERT INTO return_request VALUES ('rr','order','pending_approval',NULL)");
      await settle(pool, options); assert.equal(await balance(), '0');
      await pool.query("UPDATE return_request SET status='rejected'"); await settle(pool, options);
      assert.equal(await balance(), '10.25');
      await pool.query("UPDATE return_request SET status='approved'"); await settle(pool, options); await settle(pool, options);
      assert.equal(await balance(), '0'); assert.equal(await status('returned'), 'CANCELLED');
    });
    await t.test('approved-return mutation remains immediate and serialized with an in-flight credit', async () => {
      await reset(); await insert('race_return');
      let releaseCredit, creditReached;
      const reached = new Promise(resolve => { creditReached = resolve; });
      const pause = new Promise(resolve => { releaseCredit = resolve; });
      const paused = { connect: async () => {
        const c = await pool.connect(); return { release: () => c.release(), query: async (sql, args) => {
          const result = await c.query(sql, args);
          if (sql.includes('INSERT INTO customer_wallet')) { creditReached(); await pause; }
          return result;
        } };
      } };
      const tick = settle(paused, options);
      await reached;
      await pool.query("INSERT INTO return_request VALUES ('rr','order','approved',NULL)");
      const reversal = voidApprovedReturnCommissions(pool, { orderId: 'order', logPrefix: '[QA webhook]' });
      releaseCredit();
      await tick; assert.equal(await reversal, 1);
      assert.equal(await balance(), '0'); assert.equal(await status('race_return'), 'CANCELLED');
      assert.equal(await voidApprovedReturnCommissions(pool, { orderId: 'order' }), 0);
    });
    await t.test('approved return on an uncredited row cannot deduct unrelated wallet money', async () => {
      await reset(); await pool.query("UPDATE customer_wallet SET coins_balance=50");
      await insert('pending_return'); await pool.query("INSERT INTO return_request VALUES ('rr','order','approved',NULL)");
      await settle(pool, options); assert.equal(await balance(), '50'); assert.equal(await status('pending_return'), 'CANCELLED');
    });
    await t.test('order cancellation reverses the right role wallet exactly once', async () => {
      await reset(); await insert('state', '12.50', { source: 'state_admin', user: 'state_user', code: 'STATE' });
      await settle(pool, options); assert.equal(await balance('state_user'), '12.50');
      await pool.query(`UPDATE "order" SET canceled_at=NOW()`);
      await settle(pool, options); await settle(pool, options);
      assert.equal(Number(await balance('state_user')), 0); assert.equal(await balance(), '0');
    });
    await t.test('explicit zero-rate correction upgrades only a zero-money receipt once', async () => {
      await reset(); await insert('zero', '0'); await settle(pool, options);
      await pool.query("UPDATE affiliate_commission_log SET affiliate_commission=20, status='PENDING' WHERE id='zero'");
      await settle(pool, options); await settle(pool, options); assert.equal(await balance(), '20');
    });
    await t.test('worker CLI credits with no browser open and health check is read-only', async () => {
      await reset(); await insert('cli');
      const run = args => spawnSync(process.execPath, ['scripts/commission-settlement-worker.cjs', ...args], {
        cwd: root, env: { ...process.env, DATABASE_URL: scoped.toString() }, timeout: 15000, encoding: 'utf8',
      });
      const once = run(['--once']); assert.equal(once.status, 0, once.stderr);
      assert.equal(await balance(), '10.25');
      const health = run(['--check']); assert.equal(health.status, 0, health.stderr);
      assert.equal(JSON.parse(health.stdout.trim()).healthy, true); assert.equal(await balance(), '10.25');
      await pool.query("UPDATE partner_commission_settlement_worker SET last_error='QAError'");
      assert.equal(run(['--check']).status, 1);
    });
    await t.test('large backlog is bounded to 100 credits per transaction and drains on subsequent ticks', async () => {
      await reset();
      await pool.query(`INSERT INTO affiliate_commission_log(id,order_id,affiliate_code,status,affiliate_commission,unlock_at)
        SELECT 'batch_'||i,'order','QA','PENDING',1,'2026-01-01' FROM generate_series(1,205) i`);
      await settle(pool, options); assert.equal(await balance(), '100');
      await settle(pool, options); await settle(pool, options); assert.equal(await balance(), '205');
    });
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.end();
  }
});
