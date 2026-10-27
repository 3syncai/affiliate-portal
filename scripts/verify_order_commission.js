/* eslint-disable */
/**
 * Verify commission math for a single order (base hierarchy + additional commission).
 *
 * Usage:
 *   node scripts/verify_order_commission.js --order-id order_xxx
 *   node scripts/verify_order_commission.js --order-id order_xxx --refer-code OWEGBR3242
 *   node scripts/verify_order_commission.js --order-id order_xxx --baseline scripts/baseline-phase1-latest.json --capture-after
 *
 * With --baseline + --capture-after: captures a fresh snapshot, diffs against baseline, then verifies ledger.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const {
    toNum,
    detectSellerSourceFromLedger,
    assertOrderLedger,
    summarizeAdditionalCommission,
    sellerVisibilityFromReferrer,
    visibilityFromCommissionSource,
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
    return '';
}

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        orderId: null,
        referCode: null,
        baseline: null,
        captureAfter: false,
        captureLabel: 'after-order',
        captureOutput: null,
        tolerance: 0.02,
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--order-id' && args[i + 1]) opts.orderId = args[++i];
        else if (args[i] === '--refer-code' && args[i + 1]) opts.referCode = args[++i];
        else if (args[i] === '--baseline' && args[i + 1]) opts.baseline = args[++i];
        else if (args[i] === '--capture-after') opts.captureAfter = true;
        else if (args[i] === '--capture-label' && args[i + 1]) opts.captureLabel = args[++i];
        else if (args[i] === '--capture-output' && args[i + 1]) opts.captureOutput = args[++i];
        else if (args[i] === '--tolerance' && args[i + 1]) opts.tolerance = toNum(args[++i]);
    }
    if (!opts.orderId) {
        console.error('Usage: node verify_order_commission.js --order-id <id> [--baseline before.json] [--capture-after]');
        process.exit(1);
    }
    if (!opts.captureOutput) {
        opts.captureOutput = path.join(__dirname, 'baseline-after-order.json');
    }
    return opts;
}

const pool = new Pool({
    connectionString: loadDatabaseUrl().replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false },
});

async function fetchOrderLedger(orderId) {
    const r = await pool.query(
        `SELECT commission_source, affiliate_code, status, affiliate_rate, affiliate_commission,
                commission_amount, order_amount, additional_commission_rate, additional_commission_amount
         FROM affiliate_commission_log
         WHERE order_id = $1
         ORDER BY commission_source, affiliate_code`,
        [orderId]
    );
    return r.rows;
}

async function fetchActiveAdditionalRate(productId, sellerSource) {
    if (!productId) return 0;
    const role = visibilityFromCommissionSource(sellerSource);
    const r = await pool.query(
        `SELECT additional_rate
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
    return r.rows[0] ? toNum(r.rows[0].additional_rate) : 0;
}

async function resolveReferrerPortalRole(referCode) {
    if (!referCode) return null;
    const lower = referCode.toLowerCase();
    for (const [table, role] of [
        ['state_admin', 'state'],
        ['area_sales_manager', 'branch_manager'],
        ['branch_admin', 'asm'],
    ]) {
        const r = await pool.query(
            `SELECT id FROM ${table} WHERE LOWER(refer_code) = $1 LIMIT 1`,
            [lower]
        );
        if (r.rows[0]) return role;
    }
    return null;
}

function runCapture(label, output) {
    execSync(
        `node "${path.join(__dirname, 'capture_commission_baseline.js')}" --label ${label} --output "${output}"`,
        { stdio: 'inherit', env: process.env }
    );
}

function runDiff(before, after, orderId) {
    execSync(
        `node "${path.join(__dirname, 'diff_commission_baseline.js')}" "${before}" "${after}" --order-id ${orderId} --verify-ledger`,
        { stdio: 'inherit', env: process.env }
    );
}

async function main() {
    const opts = parseArgs();
    const rows = await fetchOrderLedger(opts.orderId);

    if (!rows.length) {
        console.error(`No commission ledger rows for order ${opts.orderId}`);
        process.exit(1);
    }

    const orderAmount = toNum(rows[0].order_amount);
    const poolAmount = toNum(rows[0].commission_amount);
    const productId = (await pool.query(
        `SELECT product_id FROM affiliate_commission_log WHERE order_id = $1 AND product_id IS NOT NULL LIMIT 1`,
        [opts.orderId]
    )).rows[0]?.product_id;

    let sellerSource = detectSellerSourceFromLedger(rows);
    if (!sellerSource && opts.referCode) {
        const portalRole = await resolveReferrerPortalRole(opts.referCode);
        if (portalRole === 'state') sellerSource = 'state_admin_direct';
        else if (portalRole === 'branch_manager') sellerSource = 'asm_direct';
        else if (portalRole === 'asm') sellerSource = 'branch_admin';
    }

    const additionalRate = toNum(
        rows.find((r) => {
            const src = String(r.commission_source || '').toLowerCase();
            return src === String(sellerSource || '').toLowerCase();
        })?.additional_commission_rate
    ) || await fetchActiveAdditionalRate(productId, sellerSource || 'branch_admin');
    const additionalSummary = summarizeAdditionalCommission(rows);

    console.log('\n=== Order Commission Verification ===');
    console.log(`Order: ${opts.orderId}`);
    console.log(`Amount: ₹${orderAmount.toFixed(2)}  Pool: ₹${poolAmount.toFixed(2)}`);
    console.log(`Product: ${productId || '—'}`);
    console.log(`Refer code hint: ${opts.referCode || '—'}`);
    console.log(`Detected path: ${sellerSource || 'unknown'}`);
    console.log(`Active additional campaign rate: ${additionalRate}%`);
    console.log(`Ledger additional totals — seller: ₹${additionalSummary.sellerAdditional.toFixed(2)}, override: ₹${additionalSummary.overrideAdditional.toFixed(2)}`);

    console.log('\n--- Ledger rows ---');
    for (const row of rows) {
        console.log(
            `  ${row.commission_source}/${row.affiliate_code}: ` +
            `₹${toNum(row.affiliate_commission).toFixed(2)} ` +
            `(additional ₹${toNum(row.additional_commission_amount).toFixed(2)}) ` +
            `${row.status}`
        );
    }

    if (!sellerSource) {
        console.warn('\nWARN: Could not detect seller path — skipping math assertion');
    } else {
        const result = assertOrderLedger(rows, {
            sellerSource,
            orderAmount,
            poolAmount,
            additionalRate,
            tolerance: opts.tolerance,
        });
        console.log('\n--- Expected math ---');
        for (const line of result.notes) console.log(line);
        if (result.ok) {
            console.log('\nPASS: Ledger matches expected base + additional commission math.');
        } else {
            console.log('\nFAIL: Ledger mismatches:');
            for (const issue of result.issues) console.log(`  - ${issue}`);
            process.exitCode = 1;
        }
    }

    if (opts.baseline) {
        const baselinePath = path.isAbsolute(opts.baseline)
            ? opts.baseline
            : path.join(process.cwd(), opts.baseline);
        if (!fs.existsSync(baselinePath)) {
            console.error(`Baseline not found: ${baselinePath}`);
            process.exitCode = 1;
        } else if (opts.captureAfter) {
            console.log('\n--- Baseline diff ---');
            runCapture(opts.captureLabel, opts.captureOutput);
            runDiff(baselinePath, opts.captureOutput, opts.orderId);
        } else {
            console.log(`\nBaseline provided (${baselinePath}) — re-run with --capture-after to diff snapshots.`);
        }
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
