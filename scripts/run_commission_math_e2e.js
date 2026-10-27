/* eslint-disable */
/**
 * Run commission math test phases 2–4 (order → deliver → credit) for a direct referral.
 *
 * Usage:
 *   node scripts/run_commission_math_e2e.js --email guptavishal0194@gmail.com --baseline scripts/baseline-phase1.json
 *
 * Requires:
 *   - Dev server at BASE_URL (default http://localhost:3001)
 *   - COMMISSION_UNLOCK_MINUTES=1 on dev server for fast credit phase
 *   - DIRECT_REFERRAL email must exist in branch_admin / area_sales_manager / state_admin
 *
 * Expected payout splits (₹1000 @ 10% → pool ₹100; rates 40/30/20/10):
 *   branch_admin code (ASM direct):     seller ₹70 + Branch Head ₹20 + State Head ₹10
 *   area_sales_manager (Branch Head):   seller ₹90 + State Head ₹10
 *   state_admin (State Head direct):    seller ₹100
 *
 * Additional commission: direct seller row only (+orderAmount × campaignRate%). Default test mode
 * is base-only (Option A) — picks a product without an active campaign. Use --product-id,
 * --require-additional-campaign, or COMMISSION_TEST_MODE=with-additional for Option B.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const {
    TEST_MODE,
    toNum,
    detectSellerSourceFromLedger,
    assertOrderLedger,
    summarizeAdditionalCommission,
    sellerVisibilityFromReferrer,
} = require('./expected_commission_math');

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const line = rawLine.replace(/\r$/, '').trim();
            if (!line || line.startsWith('#')) continue;
            if (line.startsWith('DATABASE_URL=')) {
                return line.slice('DATABASE_URL='.length).trim();
            }
        }
    }
    return 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db';
}

const connectionString = loadDatabaseUrl();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const CUSTOMER_ID = '__math_test_customer__';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false },
});

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        email: process.env.DIRECT_REFERRAL_EMAIL || 'guptavishal0194@gmail.com',
        baseline: null,
        productId: process.env.TEST_PRODUCT_ID || null,
        orderAmount: toNum(process.env.TEST_ORDER_AMOUNT) || 1000,
        productCommissionPct: toNum(process.env.TEST_PRODUCT_COMMISSION_PCT) || 10,
        skipCleanup: false,
        requireAdditionalCampaign: false,
        testMode: process.env.COMMISSION_TEST_MODE || TEST_MODE,
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--email' && args[i + 1]) opts.email = args[++i];
        else if (args[i] === '--baseline' && args[i + 1]) opts.baseline = args[++i];
        else if (args[i] === '--product-id' && args[i + 1]) opts.productId = args[++i];
        else if (args[i] === '--skip-cleanup') opts.skipCleanup = true;
        else if (args[i] === '--require-additional-campaign') opts.requireAdditionalCampaign = true;
        else if (args[i] === '--test-mode' && args[i + 1]) opts.testMode = args[++i];
    }
    if (opts.requireAdditionalCampaign) opts.testMode = 'with-additional';
    return opts;
}

function runCapture(label, output) {
    execSync(
        `node "${path.join(__dirname, 'capture_commission_baseline.js')}" --label ${label} --output "${output}"`,
        { stdio: 'inherit', env: { ...process.env, BASE_URL } }
    );
    return output;
}

function runDiff(before, after, orderId) {
    execSync(
        `node "${path.join(__dirname, 'diff_commission_baseline.js')}" "${before}" "${after}" --order-id ${orderId} --verify-ledger`,
        { stdio: 'inherit' }
    );
}

async function getActiveAdditionalCampaign(productId, portalRole) {
    const role = sellerVisibilityFromReferrer(portalRole);
    const r = await pool.query(
        `SELECT id, additional_rate, target_role, product_name
         FROM additional_commissions
         WHERE is_active = true
           AND product_id = $1
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at >= NOW())
           AND (target_role = $2 OR target_role = 'all')
         ORDER BY additional_rate DESC, created_at DESC
         LIMIT 1`,
        [productId, role]
    );
    return r.rows[0] || null;
}

async function getProductForWebhook(opts, portalRole) {
    if (opts.productId) {
        const r = await pool.query(
            `SELECT p.id AS product_id, p.title AS product_name, ac.commission_rate
             FROM product p
             LEFT JOIN affiliate_commission ac ON ac.product_id = p.id
             WHERE p.id = $1
             LIMIT 1`,
            [opts.productId]
        );
        if (!r.rows[0]) throw new Error(`Product not found: ${opts.productId}`);
        return r.rows[0];
    }

    const sellerRole = sellerVisibilityFromReferrer(portalRole);
    const baseOnly = opts.testMode !== 'with-additional' && !opts.requireAdditionalCampaign;

    if (opts.requireAdditionalCampaign || opts.testMode === 'with-additional') {
        const withCampaign = await pool.query(
            `SELECT p.id AS product_id, p.title AS product_name, ac.commission_rate,
                    adc.additional_rate AS additional_rate
             FROM additional_commissions adc
             JOIN product p ON p.id = adc.product_id
             LEFT JOIN affiliate_commission ac ON ac.product_id = p.id
             WHERE adc.is_active = true
               AND adc.starts_at <= NOW()
               AND (adc.ends_at IS NULL OR adc.ends_at >= NOW())
               AND (adc.target_role = $1 OR adc.target_role = 'all')
             ORDER BY adc.additional_rate DESC, ac.commission_rate DESC NULLS LAST
             LIMIT 1`,
            [sellerRole]
        );
        if (withCampaign.rows[0]) return withCampaign.rows[0];
        if (opts.requireAdditionalCampaign) {
            throw new Error(`No active additional_commissions campaign for role=${sellerRole}`);
        }
    }

    const noCampaignSql = baseOnly
        ? `AND NOT EXISTS (
             SELECT 1 FROM additional_commissions adc
             WHERE adc.product_id = p.id AND adc.is_active = true
               AND adc.starts_at <= NOW()
               AND (adc.ends_at IS NULL OR adc.ends_at >= NOW())
           )`
        : '';

    const product = (await pool.query(`
        SELECT p.id AS product_id, p.title AS product_name, ac.commission_rate
        FROM product p
        JOIN affiliate_commission ac ON ac.product_id = p.id
        WHERE 1=1 ${noCampaignSql}
        ORDER BY ac.commission_rate DESC NULLS LAST
        LIMIT 1
    `)).rows[0];

    if (product) return product;

    const fallback = (await pool.query(`SELECT id AS product_id, title AS product_name FROM product LIMIT 1`)).rows[0];
    if (!fallback) throw new Error('No product in DB for test order');
    return { ...fallback, commission_rate: null };
}

function validateOrderLedger(ledger, referrer, product, opts) {
    const sellerSource = detectSellerSourceFromLedger(ledger) || referrer.expectedSource;
    const sellerRow = (ledger || []).find((r) => {
        const src = String(r.commission_source || '').toLowerCase();
        return src === String(sellerSource || '').toLowerCase()
            || (sellerSource === 'branch_admin' && src === 'branch_admin');
    });
    const additionalRate = toNum(sellerRow?.additional_commission_rate) || toNum(product.additional_rate);
    const poolAmount = toNum(ledger[0]?.commission_amount);
    const summary = summarizeAdditionalCommission(ledger);

    console.log('\n--- Additional commission check ---');
    console.log(`Test mode: ${opts.testMode}`);
    console.log(`Seller additional: ₹${summary.sellerAdditional.toFixed(2)} | Override additional: ₹${summary.overrideAdditional.toFixed(2)}`);
    if (summary.overrideAdditional > 0.02) {
        console.warn('WARN: Override rows have additional commission (expected 0)');
    }

    if (product.additional_rate != null && additionalRate > 0) {
        console.log(`Active campaign on product: +${additionalRate}% for ${sellerVisibilityFromReferrer(referrer.portalRole)} role`);
    } else if (opts.testMode === 'base-only') {
        console.log('OK: base-only mode — product has no active additional campaign for this role');
    }

    const result = assertOrderLedger(ledger, {
        sellerSource: sellerSource === 'branch_admin' ? 'branch_admin'
            : sellerSource === 'asm_direct' ? 'asm_direct'
                : sellerSource === 'state_admin_direct' ? 'state_admin_direct'
                    : sellerSource,
        orderAmount: opts.orderAmount,
        poolAmount,
        additionalRate,
        tolerance: 0.02,
    });

    for (const line of result.notes) console.log(line);
    if (!result.ok) {
        console.warn('WARN: Ledger math mismatch:');
        for (const issue of result.issues) console.warn(`  - ${issue}`);
    } else {
        console.log('PASS: Ledger matches expected base + additional math.');
    }
    return result.ok;
}

async function resolveReferrer(email) {
    const lower = email.toLowerCase();

    const queries = [
        {
            sql: `SELECT id::text AS id, email, refer_code, state,
                         NULL::text AS city, NULL::text AS branch,
                         first_name, last_name
                  FROM state_admin WHERE LOWER(email) = $1 LIMIT 1`,
            expectedSource: 'state_admin_direct',
            portalRole: 'state',
        },
        {
            sql: `SELECT id::text AS id, email, refer_code, state, city,
                         NULL::text AS branch, first_name, last_name
                  FROM area_sales_manager WHERE LOWER(email) = $1 LIMIT 1`,
            expectedSource: 'asm_direct',
            portalRole: 'branch_manager',
        },
        {
            sql: `SELECT id::text AS id, email, refer_code, state, city, branch,
                         first_name, last_name
                  FROM branch_admin WHERE LOWER(email) = $1 LIMIT 1`,
            expectedSource: 'branch_admin',
            portalRole: 'asm',
        },
    ];

    for (const q of queries) {
        const r = await pool.query(q.sql, [lower]);
        if (r.rows[0]) {
            return { ...r.rows[0], expectedSource: q.expectedSource, portalRole: q.portalRole };
        }
    }
    throw new Error(`No referrer found for ${email}`);
}

async function createTestOrder() {
    const orderId = `math_test_${Date.now()}`;
    const inserted = await pool.query(
        `INSERT INTO "order" (id, currency_code, status, region_id, customer_id, sales_channel_id, email, metadata, created_at, updated_at)
         SELECT $1, o.currency_code, 'pending', o.region_id, o.customer_id, o.sales_channel_id, o.email, '{}'::jsonb, NOW(), NOW()
         FROM "order" o
         ORDER BY o.created_at DESC
         LIMIT 1
         RETURNING id`,
        [orderId]
    );
    if (inserted.rows[0]?.id) return orderId;

    await pool.query(
        `INSERT INTO "order" (id, currency_code, status, created_at, updated_at)
         VALUES ($1, 'inr', 'pending', NOW(), NOW())`,
        [orderId]
    );
    return orderId;
}

async function cleanup(orderId, referCode) {
    await pool.query(
        `DELETE FROM affiliate_commission_log WHERE order_id = $1`,
        [orderId]
    );
    await pool.query(`DELETE FROM "order" WHERE id = $1`, [orderId]).catch(() => null);
}

async function postCommissionWebhook(payload) {
    const res = await fetch(`${BASE_URL}/api/webhook/commission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Webhook failed ${res.status}: ${JSON.stringify(body)}`);
    return body;
}

async function markDelivered(orderId, referrer) {
    await pool.query(
        `UPDATE "order"
         SET fulfillment_status = 'delivered',
             status = 'completed',
             metadata = COALESCE(metadata, '{}'::jsonb) ||
                 jsonb_build_object('shiprocket_delivered_at', (NOW() AT TIME ZONE 'utc')::text)
         WHERE id = $1`,
        [orderId]
    );

    const res = await fetch(`${BASE_URL}/api/webhook/commission/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: 'DELIVERED' }),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`update-status failed ${res.status}: ${t}`);
    }

    if (referrer?.portalRole === 'branch_manager') {
        await fetch(`${BASE_URL}/api/asm/earnings?city=${encodeURIComponent(referrer.city || '')}&state=${encodeURIComponent(referrer.state || '')}&adminId=${referrer.id}`).catch(() => null);
    } else if (referrer?.portalRole === 'asm') {
        await fetch(`${BASE_URL}/api/branch/earnings?branch=${encodeURIComponent(referrer.branch || '')}&adminId=${referrer.id}`).catch(() => null);
    } else if (referrer?.portalRole === 'state') {
        await fetch(`${BASE_URL}/api/state-admin/earnings?state=${encodeURIComponent(referrer.state || '')}&adminId=${referrer.id}`).catch(() => null);
    }
    await sleep(1500);
    return res.json();
}

async function getOrderLedger(orderId) {
    return (await pool.query(
        `SELECT commission_source, affiliate_code, status, affiliate_rate, affiliate_commission,
                commission_amount, order_amount, unlock_at, credited_at,
                additional_commission_rate, additional_commission_amount
         FROM affiliate_commission_log WHERE order_id = $1 ORDER BY commission_source`,
        [orderId]
    )).rows;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function triggerSyncForReferCode(referCode) {
    await fetch(`${BASE_URL}/api/affiliate/orders`, {
        headers: { 'x-affiliate-code': referCode },
    }).catch(() => null);
    await fetch(`${BASE_URL}/api/webhook/commission/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: '__noop_sync__', status: 'PENDING' }),
    }).catch(() => null);
}

async function main() {
    const opts = parseArgs();
    const referrer = await resolveReferrer(opts.email);
    let product = await getProductForWebhook(opts, referrer.portalRole);
    const campaign = await getActiveAdditionalCampaign(product.product_id, referrer.portalRole);
    if (campaign && product.additional_rate == null) {
        product = { ...product, additional_rate: toNum(campaign.additional_rate) };
    }
    const orderId = await createTestOrder();

    const scriptsDir = __dirname;
    const beforePath = opts.baseline || path.join(scriptsDir, 'baseline-phase1-latest.json');
    const phase2Path = path.join(scriptsDir, 'baseline-phase2-order.json');
    const phase3Path = path.join(scriptsDir, 'baseline-phase3-delivered.json');
    const phase4Path = path.join(scriptsDir, 'baseline-phase4-credited.json');

    if (!fs.existsSync(beforePath)) {
        console.log('No baseline file — capturing phase1 now...');
        runCapture('phase1', beforePath);
    }

    console.log('\n=== Phase 2: Place order (direct referral) ===');
    console.log(`Referrer: ${referrer.email} (${referrer.refer_code}) role=${referrer.portalRole}`);
    console.log(`Test mode: ${opts.testMode}`);
    console.log(`Product: ${product.product_id} (${product.product_name || '?'}) commission=${product.commission_rate ?? '?'}%`);
    if (campaign) {
        console.log(`WARN: Active additional campaign +${campaign.additional_rate}% (${campaign.target_role}) on this product`);
        if (opts.testMode === 'base-only') {
            console.warn('WARN: base-only mode but product has active campaign — math will include seller bonus');
        }
    } else {
        console.log('No active additional commission campaign for this product/role');
    }
    console.log(`Order: ${orderId}  amount: ₹${opts.orderAmount}`);

    const webhookPayload = {
        order_id: orderId,
        affiliate_code: referrer.refer_code,
        product_id: product.product_id,
        product_name: product.product_name || 'Math Test Product',
        quantity: 1,
        item_price: opts.orderAmount,
        order_amount: opts.orderAmount,
        status: 'PENDING',
        customer_id: CUSTOMER_ID,
        customer_name: 'Math Test Customer',
        customer_email: 'mathtest@example.com',
    };

    await postCommissionWebhook(webhookPayload);
    let ledger = await getOrderLedger(orderId);
    console.log('Ledger after order:', ledger);
    validateOrderLedger(ledger, referrer, product, opts);

    const allPending = ledger.every((r) => r.status === 'PENDING');
    const noUnlock = ledger.every((r) => !r.unlock_at);
    if (!allPending || !noUnlock) {
        console.warn('WARN: Expected all PENDING with unlock_at NULL before delivery');
    }

    runCapture('phase2-order', phase2Path);
    runDiff(beforePath, phase2Path, orderId);

    console.log('\n=== Phase 3: Mark delivered ===');
    await markDelivered(orderId, referrer);
    await sleep(2000);
    ledger = await getOrderLedger(orderId);
    console.log('Ledger after delivery:', ledger);

    const hasUnlock = ledger.some((r) => r.unlock_at);
    const stillPending = ledger.every((r) => r.status === 'PENDING');
    console.log(stillPending ? 'OK: still PENDING' : 'WARN: some rows credited early');
    console.log(hasUnlock ? 'OK: unlock_at set' : 'WARN: unlock_at not set');

    runCapture('phase3-delivered', phase3Path);
    runDiff(phase2Path, phase3Path, orderId);

    console.log('\n=== Phase 4: Expire unlock window and sync ===');
    await pool.query(
        `UPDATE affiliate_commission_log
         SET unlock_at = NOW() - INTERVAL '1 minute'
         WHERE order_id = $1 AND status = 'PENDING'`,
        [orderId]
    );
    await fetch(`${BASE_URL}/api/asm/earnings?city=${encodeURIComponent(referrer.city || '')}&state=${encodeURIComponent(referrer.state || '')}&adminId=${referrer.id}`).catch(() => null);
    await fetch(`${BASE_URL}/api/branch/earnings?branch=${encodeURIComponent(referrer.branch || '')}&adminId=${referrer.id}`).catch(() => null);
    await fetch(`${BASE_URL}/api/state-admin/earnings?state=${encodeURIComponent(referrer.state || '')}&adminId=${referrer.id}`).catch(() => null);
    await sleep(3000);
    ledger = await getOrderLedger(orderId);
    console.log('Ledger after unlock:', ledger);

    runCapture('phase4-credited', phase4Path);
    runDiff(phase3Path, phase4Path, orderId);
    runDiff(beforePath, phase4Path, orderId);

    const poolAmount = toNum(ledger[0]?.commission_amount);
    console.log('\n=== Math worksheet ===');
    console.log(`commission_pool (from ledger): ₹${poolAmount.toFixed(2)}`);
    for (const row of ledger) {
        const addl = toNum(row.additional_commission_amount);
        console.log(
            `  ${row.commission_source}: rate=${row.affiliate_rate}% payout=₹${toNum(row.affiliate_commission).toFixed(2)}` +
            (addl > 0 ? ` (additional ₹${addl.toFixed(2)})` : '') +
            ` status=${row.status}`
        );
    }

    if (!opts.skipCleanup) {
        console.log('\nCleaning up test order...');
        await cleanup(orderId, referrer.refer_code);
    } else {
        console.log(`\nSkipped cleanup — order_id=${orderId}`);
    }

    console.log('\nE2E flow complete.');
    console.log(`Snapshots: ${phase2Path}, ${phase3Path}, ${phase4Path}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
