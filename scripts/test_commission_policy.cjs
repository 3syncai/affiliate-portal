// Run only against a disposable local database:
// COMMISSION_POLICY_TEST_DATABASE_URL=postgres://localhost:55440/postgres node affiliate-portal/scripts/test_commission_policy.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const url = process.env.COMMISSION_POLICY_TEST_DATABASE_URL;
if (!url) throw new Error('COMMISSION_POLICY_TEST_DATABASE_URL is required');
const parsed = new URL(url);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.port !== '55440') {
    throw new Error('Only the disposable local PostgreSQL instance on port 55440 is allowed');
}
async function run() {
    const db = new Client({ connectionString: url });
    await db.connect();
    try {
        await db.query(`
          CREATE TABLE "order" (id text PRIMARY KEY, metadata jsonb);
          CREATE TABLE order_item (order_id text, item_id text);
          CREATE TABLE order_line_item (id text, product_id text, variant_id text);
          CREATE TABLE product_variant (id text, product_id text);
          CREATE TABLE product_category (id text, parent_category_id text);
          CREATE TABLE product_category_product (product_id text, product_category_id text);
          CREATE TABLE category_return_policy (category_id text, return_window_days integer, replacement_window_days integer);
          CREATE TABLE order_fulfillment (order_id text, fulfillment_id text);
          CREATE TABLE fulfillment (id text, delivered_at timestamptz, canceled_at timestamptz);
          CREATE TABLE affiliate_commission_log (id text, order_id text, status text, unlock_at timestamptz, credited_at timestamptz, commission_source text, affiliate_user_id text, affiliate_code text, affiliate_commission numeric DEFAULT 0, additional_commission_amount numeric DEFAULT 0);
          INSERT INTO "order" VALUES ('o', '{}');
          INSERT INTO fulfillment VALUES ('f', NOW() - INTERVAL '1 day', NULL);
          INSERT INTO order_fulfillment VALUES ('o', 'f');
          INSERT INTO order_item VALUES ('o', 'i');
          INSERT INTO order_line_item VALUES ('i', 'p', NULL);
          INSERT INTO product_category VALUES ('parent', NULL), ('child', 'parent'), ('leaf', 'child');
          INSERT INTO product_category_product VALUES ('p', 'parent'), ('p', 'child');
          INSERT INTO category_return_policy VALUES ('parent', 5, 10);
          INSERT INTO affiliate_commission_log(id,order_id,status,unlock_at,credited_at) VALUES ('legacy', 'o', 'PENDING', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes', NULL);
          INSERT INTO affiliate_commission_log(id,order_id,status,unlock_at,credited_at) VALUES ('settled', 'o', 'CREDITED', NOW() - INTERVAL '1 hour', NOW());
        `);
        const migration = fs.readFileSync(path.join(__dirname, '../migrations/update_commission_unlock_policy.sql'), 'utf8');
        await db.query(migration);
        async function days(expected) {
            const result = await db.query("SELECT resolve_commission_hold_days('o') AS days");
            assert.equal(result.rows[0].days, expected);
        }
        await days(10); // child inherits parent, max(5, 10)
        let row = (await db.query("SELECT *, EXTRACT(EPOCH FROM (unlock_at - policy_delivered_at))/86400 AS days FROM affiliate_commission_log WHERE id='legacy'")).rows[0];
        assert.equal(Number(row.days), 10);
        assert.equal(row.status, 'PENDING');
        assert.equal((await db.query("SELECT status FROM affiliate_commission_log WHERE id='settled'")).rows[0].status, 'CREDITED');
        await db.query("INSERT INTO category_return_policy VALUES ('child', 3, 2)");
        await days(3); // subcategory overrides a longer parent policy
        await db.query("INSERT INTO product_category_product VALUES ('p', 'leaf')");
        await days(3); // nearest configured ancestor of deeper assigned category
        await db.query("DELETE FROM category_return_policy");
        await days(7);
        await db.query("INSERT INTO category_return_policy VALUES ('child', 0, 0)");
        await days(0); // explicit no-return/no-replacement is not missing policy
        await db.query("INSERT INTO order_item VALUES ('o','i2'); INSERT INTO order_line_item VALUES ('i2',NULL,'v2'); INSERT INTO product_variant VALUES ('v2','p2')");
        await days(7); // uncategorized product contributes its default
        await db.query("INSERT INTO product_category VALUES ('other',NULL); INSERT INTO product_category_product VALUES ('p2','other'); INSERT INTO category_return_policy VALUES ('other',14,5)");
        await days(14); // longest window across the whole order
        await db.query("UPDATE affiliate_commission_log SET status='CREDITED', unlock_at=NOW()-INTERVAL '1 second' WHERE id='legacy'");
        row = (await db.query("SELECT status, policy_hold_days FROM affiliate_commission_log WHERE id='legacy'")).rows[0];
        assert.equal(row.status, 'PENDING');
        assert.equal(row.policy_hold_days, 10); // policy freezes at scheduling
        await db.query("INSERT INTO affiliate_commission_log(id,order_id,status,unlock_at) VALUES ('bypass','o','CREDITED',NOW()-INTERVAL '1 second')");
        assert.equal((await db.query("SELECT status FROM affiliate_commission_log WHERE id='bypass'")).rows[0].status, 'PENDING');
        await db.query("INSERT INTO \"order\" VALUES ('undelivered','{}'); INSERT INTO affiliate_commission_log(id,order_id,status,unlock_at) VALUES ('undelivered','undelivered','CREDITED',NOW()-INTERVAL '1 second')");
        row = (await db.query("SELECT status,unlock_at FROM affiliate_commission_log WHERE id='undelivered'")).rows[0];
        assert.equal(row.status, 'PENDING'); assert.equal(row.unlock_at, null);
        await db.query("UPDATE affiliate_commission_log SET policy_delivered_at=NOW()-INTERVAL '20 days', status='CREDITED' WHERE id='legacy'");
        assert.equal((await db.query("SELECT status FROM affiliate_commission_log WHERE id='legacy'")).rows[0].status, 'CREDITED');
        await db.query(migration); // idempotent migration leaves frozen/settled rows alone
        // Execute the actual partner/admin sync SQL against PostgreSQL, including
        // scheduling, migration repair, and promotion on repeated dashboard polls.
        const vm = require('node:vm');
        const ts = require('typescript');
        const context = { exports: {}, console, require(name) {
            if (name === '@/lib/dashboard-return-sql') return { COMMISSION_HAS_ANY_RETURN_REQUEST_SQL: 'FALSE' };
            if (name === '@/lib/void-return-commission') return { voidCommissionsForApprovedReturns: async () => {} };
            throw new Error(`Unexpected import: ${name}`);
        }};
        vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/affiliate-commission-sync.ts'), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
        }).outputText, context);
        await db.query("INSERT INTO affiliate_commission_log(id,order_id,status) VALUES ('sync','undelivered','PENDING'); INSERT INTO order_item SELECT 'undelivered',item_id FROM order_item WHERE order_id='o'; INSERT INTO order_fulfillment VALUES ('undelivered','f')");
        const sync = () => context.exports.syncAffiliateCommissionStatuses(db, { logPrefix: '[policy-test]' });
        await sync();
        row = (await db.query("SELECT status,policy_hold_days FROM affiliate_commission_log WHERE id='sync'")).rows[0];
        assert.equal(row.policy_hold_days, 14); assert.equal(row.status, 'PENDING');
        await db.query("UPDATE affiliate_commission_log SET policy_delivered_at=NOW()-INTERVAL '20 days' WHERE id='sync'");
        await sync(); await sync();
        assert.equal((await db.query("SELECT status FROM affiliate_commission_log WHERE id='sync'")).rows[0].status, 'CREDITED');
        const webhook = fs.readFileSync(path.join(__dirname, '../../src/app/api/webhooks/order-delivered/route.ts'), 'utf8');
        const webhookSql = webhook.match(/UPDATE affiliate_commission_log\s+SET policy_delivered_at[\s\S]*?AND status = 'PENDING'/)[0];
        await db.query(webhookSql, ['bypass','partner-user']);
        row = (await db.query("SELECT status,policy_hold_days,affiliate_user_id FROM affiliate_commission_log WHERE id='bypass'")).rows[0];
        assert.equal(row.status, 'PENDING'); assert.equal(row.policy_hold_days, 14); assert.equal(row.affiliate_user_id, 'partner-user');
        // Debug release must credit every supported role once and atomically.
        await db.query(`ALTER TABLE "order" ADD COLUMN status text DEFAULT 'completed', ADD COLUMN deleted_at timestamptz;
          CREATE TABLE vendor_earnings_log(order_id text, vendor_id text, status text, credited_at timestamptz, unlock_at timestamptz, updated_at timestamptz);
          CREATE TABLE return_request(id text, order_id text, status text, deleted_at timestamptz);
          CREATE TABLE affiliate_user(id text, refer_code text);
          CREATE TABLE customer_wallet(customer_id text PRIMARY KEY, coins_balance numeric);
          INSERT INTO affiliate_user VALUES ('partner','PARTNER');
          INSERT INTO vendor_earnings_log(order_id,vendor_id,status) VALUES ('o','vendor','UNLOCKING');
        `);
        const debugContext = { exports: {}, require() { throw new Error('Unexpected runtime import'); } };
        vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/lib/debug-controller/settlement.ts'), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
        }).outputText, debugContext);
        const pool = new (require('pg').Pool)({ connectionString: url });
        try {
          const roles = ['affiliate','branch_admin','area_manager','asm_direct','state_admin','state_admin_direct'];
          for (let i=0;i<roles.length;i++) await db.query(`INSERT INTO affiliate_commission_log(id,order_id,status,commission_source,affiliate_user_id,affiliate_code,affiliate_commission)
            VALUES ($1,'o','PENDING',$2,$3,'PARTNER',$4)`, ['debug'+i,roles[i],roles[i],(i+1)*10]);
          const release = () => debugContext.exports.forceSettleDebugOrder(pool,'o');
          const first = await release();
          assert.equal(first.promoted,1); assert.equal(first.walletsCredited,6);
          assert.equal(Number((await db.query('SELECT SUM(coins_balance) AS total FROM customer_wallet')).rows[0].total),210);
          await Promise.all([release(),release()]);
          assert.equal(Number((await db.query('SELECT SUM(coins_balance) AS total FROM customer_wallet')).rows[0].total),210);
          await db.query(`INSERT INTO "order"(id) VALUES ('failure');
            INSERT INTO vendor_earnings_log(order_id,vendor_id,status) VALUES ('failure','vendor','UNLOCKING');
            INSERT INTO affiliate_commission_log(id,order_id,status,commission_source,affiliate_commission) VALUES ('bad','failure','PENDING','affiliate',100);`);
          await assert.rejects(debugContext.exports.forceSettleDebugOrder(pool,'failure'), /wallet recipient/);
          assert.equal((await db.query("SELECT status FROM vendor_earnings_log WHERE order_id='failure'")).rows[0].status,'UNLOCKING');
          assert.equal((await db.query("SELECT status FROM affiliate_commission_log WHERE id='bad'")).rows[0].status,'PENDING');
          await db.query(`ALTER TABLE "order" ADD COLUMN display_id integer DEFAULT 1, ADD COLUMN email text;
            ALTER TABLE vendor_earnings_log ADD COLUMN net_amount numeric DEFAULT 10, ADD COLUMN order_display_id text;
            DELETE FROM vendor_earnings_log WHERE order_id='failure';`);
          const ordersSource = fs.readFileSync(path.join(__dirname, '../../src/app/api/debug-controller/orders/route.ts'), 'utf8');
          const pendingSql = ordersSource.match(/WITH pending AS \([\s\S]*?LIMIT 100/)[0];
          const pending = (await db.query(pendingSql)).rows.find(row => row.order_id === 'failure');
          assert.ok(pending); assert.equal(Number(pending.vendor_count),0); assert.equal(Number(pending.commission_count),1);
          await db.query("INSERT INTO return_request VALUES ('return','failure','pending',NULL)");
          await assert.rejects(debugContext.exports.forceSettleDebugOrder(pool,'failure'), /active return/);
          console.log('PASS: debug release credits all six role sources, concurrent retries do not duplicate credit, missing recipient rolls back vendor and commission, active returns block release');
        } finally { await pool.end(); }
        await db.query('DROP TABLE category_return_policy');
        await days(7); // policy table not yet configured
        console.log('PASS: policy inheritance, override, default, zero days, mixed products, legacy upgrade, frozen dates, early-credit protection, delivery prerequisite, elapsed hold, migration rerun');
    } finally {
        await db.query(`DROP TABLE IF EXISTS vendor_earnings_log, return_request, affiliate_user, customer_wallet, affiliate_commission_log, order_fulfillment, fulfillment,
          category_return_policy, product_category_product, product_category, product_variant,
          order_line_item, order_item, "order" CASCADE;
          DROP FUNCTION IF EXISTS enforce_commission_unlock_delay(), resolve_commission_hold_days(text), resolve_commission_delivered_at(text);`);
        await db.end();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
