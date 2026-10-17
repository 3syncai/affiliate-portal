/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
// Real PostgreSQL tests in a temporary schema; never calls an external receiver.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const portal = process.env.AFFILIATE_PORTAL_PATH || path.resolve(__dirname, '..');
const ts = require(path.join(portal, 'node_modules/typescript'));
const { Pool } = require(path.join(portal, 'node_modules/pg'));
require(path.join(portal, 'node_modules/@next/env')).loadEnvConfig(portal);
const schema = 'qa_affiliate_event_' + crypto.randomBytes(8).toString('hex');
const url = process.env.DATABASE_URL;
if (!url) throw Error('DATABASE_URL required');
const options = { connectionString: url, ssl: url.includes('amazonaws.com') ? { rejectUnauthorized: false } : false };
const admin = new Pool(options);
let pool;
let created = false;
const results = [];
const quiet = { log() {}, error() {} };
function load(file, stubs = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(portal, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => name in stubs ? stubs[name] : require(name), console: quiet, process, Buffer, setTimeout });
  return exports;
}
async function test(name, run) { await run(); results.push({ name, result: 'PASS' }); console.log('PASS:', name); }
(async () => {
  await admin.query('CREATE SCHEMA ' + schema); created = true;
  const scoped = new URL(url); scoped.searchParams.set('options', '-csearch_path=' + schema);
  pool = new Pool({ ...options, connectionString: scoped.toString(), max: 12 });
  await pool.query(fs.readFileSync(path.join(portal, 'migrations/add_commission_webhook_events.sql'), 'utf8'));
  await pool.query('CREATE TABLE commission_effect (id bigserial PRIMARY KEY, order_id text, amount integer)');
  const { receiveCommissionEvent, CommissionEventConflict } = load('lib/commission-webhook-transaction.ts');
  const duplicate = () => ({ status: 200, duplicate: true });
  const payload = id => ({ event_id: id, order_id: 'order_' + id, amount: 100 });
  const effects = async order => Number((await pool.query('SELECT count(*) AS n FROM commission_effect WHERE order_id=$1', [order])).rows[0].n);
  const receipt = async id => Number((await pool.query('SELECT count(*) AS n FROM affiliate_commission_webhook_event WHERE event_id=$1', [id])).rows[0].n);
  let notifications = 0;
  const apply = async (client, afterCommit) => {
    await client.query("INSERT INTO commission_effect(order_id,amount) VALUES (current_setting('qa.order_id'),100)");
    afterCommit(() => { notifications++; }); return { status: 200 };
  };
  const run = p => receiveCommissionEvent(pool, p, p.event_id, async (client, notify) => {
    await client.query("SELECT set_config('qa.order_id',$1,true)", [p.order_id]); return apply(client, notify);
  }, duplicate);
  await test('serial replay produces one committed effect and notification', async () => {
    const p = payload('serial'); await run(p); assert.equal((await run(p)).duplicate, true);
    assert.equal(await effects(p.order_id), 1); assert.equal(notifications, 1); assert.equal(await receipt(p.event_id), 1);
  });
  await test('ten simultaneous identical deliveries produce one effect', async () => {
    const p = payload('concurrent'); const responses = await Promise.all(Array.from({ length: 10 }, () => run(p)));
    assert.equal(responses.filter(r => r.duplicate).length, 9); assert.equal(await effects(p.order_id), 1);
  });
  await test('same ID with changed payload is rejected', async () => {
    const p = payload('serial'); await assert.rejects(run({ ...p, amount: 101 }), CommissionEventConflict);
    assert.equal(await effects(p.order_id), 1);
  });
  await test('header/body key mismatch is rejected before financial writes', async () => {
    await assert.rejects(receiveCommissionEvent(pool, payload('mismatch'), 'different', apply, duplicate), CommissionEventConflict);
    assert.equal(await receipt('mismatch'), 0);
  });
  await test('payload object key ordering does not alter replay identity', async () => {
    const p = payload('serial'); assert.equal((await run({ amount: p.amount, order_id: p.order_id, event_id: p.event_id })).duplicate, true);
  });
  await test('failure after partial writes rolls back receipt, effects and notification; retry succeeds', async () => {
    const p = payload('rollback'); const before = notifications;
    await assert.rejects(receiveCommissionEvent(pool, p, p.event_id, async (c, notify) => {
      await c.query('INSERT INTO commission_effect(order_id,amount) VALUES($1,50)', [p.order_id]);
      notify(() => { notifications++; }); throw Error('simulated interruption before second commission');
    }, duplicate), /simulated interruption/);
    assert.equal(await effects(p.order_id), 0); assert.equal(await receipt(p.event_id), 0); assert.equal(notifications, before);
    await run(p); assert.equal(await effects(p.order_id), 1);
  });
  await test('error response rolls back writes instead of acknowledging event', async () => {
    const p = payload('response500'); const response = await receiveCommissionEvent(pool, p, p.event_id, async c => {
      await c.query('INSERT INTO commission_effect(order_id,amount) VALUES($1,50)', [p.order_id]); return { status: 500 };
    }, duplicate);
    assert.equal(response.status, 500); assert.equal(await receipt(p.event_id), 0); assert.equal(await effects(p.order_id), 0);
  });
  await test('swallowed SQL failure cannot turn aborted COMMIT into success', async () => {
    const p = payload('aborted'); await assert.rejects(receiveCommissionEvent(pool, p, p.event_id, async c => {
      try { await c.query('SELECT missing_column FROM commission_effect'); } catch {}
      return { status: 200 };
    }, duplicate), /did not commit/); assert.equal(await receipt(p.event_id), 0);
  });
  await test('legacy requests for the same order serialize check-and-insert', async () => {
    const p = { order_id: 'legacy' };
    const legacy = () => receiveCommissionEvent(pool, p, null, async c => {
      if (!(await c.query('SELECT 1 FROM commission_effect WHERE order_id=$1', [p.order_id])).rowCount) {
        await c.query('SELECT pg_sleep(0.03)');
        await c.query('INSERT INTO commission_effect(order_id,amount) VALUES($1,100)', [p.order_id]);
      } return { status: 200 };
    }, duplicate);
    await Promise.all(Array.from({ length: 5 }, legacy)); assert.equal(await effects(p.order_id), 1);
  });
  await test('connection termination rolls back partial work and receipt; retry succeeds', async () => {
    const p = payload('disconnect');
    await assert.rejects(receiveCommissionEvent(pool, p, p.event_id, async c => {
      c.on('error', () => {});
      await c.query('INSERT INTO commission_effect(order_id,amount) VALUES($1,50)', [p.order_id]);
      const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await pool.query('SELECT pg_terminate_backend($1)', [pid]);
      await c.query('SELECT 1'); return { status: 200 };
    }, duplicate));
    assert.equal(await effects(p.order_id), 0); assert.equal(await receipt(p.event_id), 0);
    await run(p); assert.equal(await effects(p.order_id), 1);
  });
  await test('receipt persists across a new pool (restart) and prevents replay', async () => {
    const p = payload('serial'); const fresh = new Pool({ ...options, connectionString: scoped.toString() });
    try { const response = await receiveCommissionEvent(fresh, p, p.event_id, async () => { throw Error('must not execute'); }, duplicate); assert.equal(response.duplicate, true); }
    finally { await fresh.end(); }
  });
  // Exercise the actual route with a controlled query adapter: receipt wrapper stays real.
  const next = { NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, body }) } };
  let fault = false; let bonusDb; let syncDb;
  const routePool = { connect: async () => {
    const c = await pool.connect(); const query = c.query.bind(c);
    const intercept = async (sql, params) => {
      if (/^BEGIN|^COMMIT|^ROLLBACK|pg_advisory|affiliate_commission_webhook_event/.test(sql.trim())) return query(sql, params);
      if (/INSERT INTO affiliate_commission_log/.test(sql)) return query('INSERT INTO commission_effect(order_id,amount) VALUES($1,100)', [params[0]]);
      if (/FROM commission_rates/.test(sql)) return { rows: [{ commission_percentage: '70' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }; return { query: intercept, release: () => c.release() };
  } };
  const route = load('app/api/webhook/commission/route.ts', {
    'next/server': next, '@/lib/db': { default: routePool },
    '@/lib/commission-webhook-transaction': { receiveCommissionEvent, CommissionEventConflict },
    '@/lib/sse': { sendNotification() {} },
    '@/lib/additional-commission': { ensureAdditionalCommissionSchema: async () => {}, applyAdditionalCommissionForOrder: async (id, db) => { bonusDb = db; if (fault) throw Error('bonus failure'); } },
    '@/lib/affiliate-commission-sync': { syncAffiliateCommissionStatuses: async db => { syncDb = db; } },
    '@/lib/repair-branch-admin-commissions': { resolveBranchAdminForSale: async () => null },
  });
  const request = p => ({ json: async () => ({ ...p }), headers: { get: () => p.event_id } });
  await test('actual route commits once and passes transaction client to commission helpers', async () => {
    const p = { ...payload('route'), affiliate_code: 'QA', product_id: 'QA', product_name: 'QA', order_amount: 100 };
    assert.equal((await route.POST(request(p))).status, 200); assert.equal((await route.POST(request(p))).body.duplicate, true);
    assert.equal(await effects(p.order_id), 1); assert.equal(bonusDb, syncDb); assert.ok(bonusDb.query);
  });
  await test('actual route bonus failure rolls back base commission; retry succeeds', async () => {
    const p = { ...payload('routefail'), affiliate_code: 'QA', product_id: 'QA', order_amount: 100 };
    fault = true; assert.equal((await route.POST(request(p))).status, 500);
    assert.equal(await effects(p.order_id), 0); assert.equal(await receipt(p.event_id), 0);
    fault = false; assert.equal((await route.POST(request(p))).status, 200); assert.equal(await effects(p.order_id), 1);
  });
  console.log(JSON.stringify({ passed: results.length, scope: 'isolated PostgreSQL transactions and actual route with controlled business-query fixtures; no live affiliate delivery' }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (pool) await pool.end();
  if (created && /^qa_affiliate_event_[a-f0-9]{16}$/.test(schema)) await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
  await admin.end();
});
