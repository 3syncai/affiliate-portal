/* eslint-disable */
/**
 * Diff two commission baseline snapshots.
 *
 * Usage:
 *   node scripts/diff_commission_baseline.js scripts/baseline-phase1.json scripts/baseline-phase2.json
 *   node scripts/diff_commission_baseline.js before.json after.json --order-id order_xxx
 *   node scripts/diff_commission_baseline.js before.json after.json --order-id order_xxx --verify-ledger
 *
 * Expected per-order payout (₹1000 @ 10% pool = ₹100; rates 40/30/20/10):
 *   ASM direct (branch_admin code):     ₹70 + ₹20 + ₹10  (3 parties)
 *   Branch Head direct (area_sales_manager): ₹90 + ₹10
 *   State Head direct:                  ₹100
 *
 * Additional commission: only direct seller row gets orderAmount × campaignRate%; overrides unchanged.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
    toNum,
    detectSellerSourceFromLedger,
    assertOrderLedger,
    summarizeAdditionalCommission,
    visibilityFromCommissionSource,
} = require('./expected_commission_math');

const NUMERIC_KEYS = [
    'lifetimeEarnings', 'totalEarnings', 'creditedLifetimeEarnings', 'pendingEarnings',
    'currentEarnings', 'availableBalance', 'paidAmount',
    'earningsFromOverrides', 'pendingFromOverrides', 'earningsFromDirect', 'pendingFromDirect',
    'earningsFromBranch', 'pendingFromBranch', 'overrideEarnings', 'pendingOverrideEarnings',
    'directEarnings', 'pendingDirectEarnings',
    'totalCommission', 'totalOrders', 'totalReturns',
    'lifetime_earnings', 'currentEarnings', 'paidAmount',
    'totalAdditionalCommission',
];

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
    const files = args.filter((a) => !a.startsWith('--'));
    const opts = { orderId: null, tolerance: 0.02, verifyLedger: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--order-id' && args[i + 1]) opts.orderId = args[++i];
        else if (args[i] === '--tolerance' && args[i + 1]) opts.tolerance = toNum(args[++i]);
        else if (args[i] === '--verify-ledger') opts.verifyLedger = true;
    }
    if (files.length < 2) {
        console.error('Usage: node diff_commission_baseline.js <before.json> <after.json> [--order-id id] [--verify-ledger]');
        process.exit(1);
    }
    return { beforePath: files[0], afterPath: files[1], ...opts };
}

function loadSnapshot(filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function findAccount(snapshot, label) {
    if (label === 'National Head — platform') return snapshot.national?.platformStats || null;
    return snapshot.accounts.find((a) => a.label === label);
}

function extractMetrics(acct) {
    if (!acct) return {};
    if (acct.platformStats) {
        const p = acct.platformStats || acct;
        return {
            totalCommission: toNum(p.totalCommission),
            totalOrders: toNum(p.totalOrders),
            totalReturns: toNum(p.totalReturns),
        };
    }
    const e = acct.earningsApi || {};
    const out = {
        walletBalance: toNum(acct.walletBalance),
        totalAdditionalCommission: toNum(acct.totalAdditionalCommission),
    };
    for (const key of NUMERIC_KEYS) {
        if (e[key] !== undefined && e[key] !== null) out[key] = toNum(e[key]);
    }
    return out;
}

function ledgerTotals(ledger) {
    const byStatus = {};
    for (const row of ledger || []) {
        const k = `${row.commission_source}/${row.status}`;
        byStatus[k] = (byStatus[k] || 0) + toNum(row.amount);
    }
    return byStatus;
}

function diffMetrics(before, after, tolerance) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const deltas = [];
    for (const key of keys) {
        const b = before[key] ?? 0;
        const a = after[key] ?? 0;
        const delta = a - b;
        if (Math.abs(delta) > tolerance) {
            deltas.push({ key, before: b, after: a, delta });
        }
    }
    return deltas;
}

function printReport(beforeSnap, afterSnap, opts) {
    console.log('\n=== Commission Baseline Diff ===');
    console.log(`Before: ${beforeSnap.meta?.label || '?'} @ ${beforeSnap.meta?.capturedAt}`);
    console.log(`After:  ${afterSnap.meta?.label || '?'} @ ${afterSnap.meta?.capturedAt}`);
    if (beforeSnap.meta?.testMode || afterSnap.meta?.testMode) {
        console.log(`Test mode: before=${beforeSnap.meta?.testMode || '?'} after=${afterSnap.meta?.testMode || '?'}`);
    }
    if (opts.orderId) console.log(`Order: ${opts.orderId}`);

    const labels = [
        'National Head — platform',
        ...beforeSnap.accounts.map((a) => a.label),
    ];

    let anyChange = false;

    for (const label of labels) {
        if (label === 'National Head — platform') {
            const b = extractMetrics(beforeSnap.national?.platformStats);
            const a = extractMetrics(afterSnap.national?.platformStats);
            const deltas = diffMetrics(b, a, opts.tolerance);
            if (deltas.length) {
                anyChange = true;
                console.log(`\n[${label}]`);
                for (const d of deltas) {
                    const sign = d.delta >= 0 ? '+' : '';
                    console.log(`  ${d.key}: ₹${d.before.toFixed(2)} → ₹${d.after.toFixed(2)} (${sign}₹${d.delta.toFixed(2)})`);
                }
            }
            continue;
        }

        const bAcct = findAccount(beforeSnap, label);
        const aAcct = findAccount(afterSnap, label);
        if (!bAcct && !aAcct) continue;

        const bMetrics = extractMetrics(bAcct);
        const aMetrics = extractMetrics(aAcct);
        const deltas = diffMetrics(bMetrics, aMetrics, opts.tolerance);

        const bLedger = ledgerTotals(bAcct?.ledger);
        const aLedger = ledgerTotals(aAcct?.ledger);
        const ledgerDeltas = diffMetrics(bLedger, aLedger, opts.tolerance);

        if (deltas.length || ledgerDeltas.length) {
            anyChange = true;
            console.log(`\n[${label}] ${aAcct?.profile?.email || bAcct?.profile?.email || ''}`);
            for (const d of deltas) {
                const sign = d.delta >= 0 ? '+' : '';
                console.log(`  ${d.key}: ₹${d.before.toFixed(2)} → ₹${d.after.toFixed(2)} (${sign}₹${d.delta.toFixed(2)})`);
            }
            if (ledgerDeltas.length) {
                console.log('  ledger changes:');
                for (const d of ledgerDeltas) {
                    const sign = d.delta >= 0 ? '+' : '';
                    console.log(`    ${d.key}: ₹${d.before.toFixed(2)} → ₹${d.after.toFixed(2)} (${sign}₹${d.delta.toFixed(2)})`);
                }
            }
        }
    }

    if (!anyChange) {
        console.log('\nNo numeric changes above tolerance.');
    }

    console.log('\n--- Expected phase checks ---');
    console.log('After ORDER (not delivered): pending↑ credited/wallet flat, unlock_at null on new rows');
    console.log('After DELIVERY: still pending, unlock_at set, wallet flat');
    console.log('After UNLOCK: pending↓ credited↑ wallet↑ by payout amount');
    console.log('\n--- Expected payout splits (₹1000 @ 10% → pool ₹100) ---');
    console.log('ASM direct (branch_admin code):     ₹70 + ₹20 + ₹10  (3 ledger rows)');
    console.log('Branch Head direct (area_sales_manager): ₹90 + ₹10');
    console.log('State Head direct:                  ₹100');
    console.log('\n--- Additional commission ---');
    console.log('Direct seller row only: +orderAmount × campaignRate%; override rows (BRANCH/AREA/STATE) stay at base amounts.');
}

async function verifyOrderLedgerFromDb(orderId, tolerance) {
    const connectionString = loadDatabaseUrl();
    if (!connectionString) {
        console.warn('\nWARN: DATABASE_URL not set — skipping ledger verification');
        return;
    }

    const pool = new Pool({
        connectionString: connectionString.replace('?sslmode=no-verify', ''),
        ssl: { rejectUnauthorized: false },
    });

    try {
        const rows = (await pool.query(
            `SELECT commission_source, affiliate_code, status, affiliate_commission, commission_amount,
                    order_amount, additional_commission_rate, additional_commission_amount, product_id
             FROM affiliate_commission_log WHERE order_id = $1 ORDER BY commission_source`,
            [orderId]
        )).rows;

        if (!rows.length) {
            console.log(`\n--- Ledger verification ---\nNo rows for order ${orderId}`);
            return;
        }

        const sellerSource = detectSellerSourceFromLedger(rows);
        const orderAmount = toNum(rows[0].order_amount);
        const poolAmount = toNum(rows[0].commission_amount);
        const productId = rows.find((r) => r.product_id)?.product_id;
        let additionalRate = 0;
        if (productId && sellerSource) {
            const role = visibilityFromCommissionSource(sellerSource);
            const camp = await pool.query(
                `SELECT additional_rate FROM additional_commissions
                 WHERE is_active = true AND product_id = $1
                   AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW())
                   AND (target_role = $2 OR target_role = 'all')
                 ORDER BY additional_rate DESC LIMIT 1`,
                [productId, role]
            );
            additionalRate = camp.rows[0] ? toNum(camp.rows[0].additional_rate) : 0;
        }

        const summary = summarizeAdditionalCommission(rows);
        console.log('\n--- Ledger verification ---');
        console.log(`Path: ${sellerSource || 'unknown'} | additional campaign: ${additionalRate}%`);
        console.log(`Seller additional: ₹${summary.sellerAdditional.toFixed(2)} | Override additional: ₹${summary.overrideAdditional.toFixed(2)}`);

        for (const row of rows) {
            console.log(
                `  ${row.commission_source}/${row.affiliate_code}: ₹${toNum(row.affiliate_commission).toFixed(2)} ` +
                `(additional ₹${toNum(row.additional_commission_amount).toFixed(2)}) ${row.status}`
            );
        }

        if (sellerSource) {
            const result = assertOrderLedger(rows, {
                sellerSource,
                orderAmount,
                poolAmount,
                additionalRate,
                tolerance,
            });
            for (const line of result.notes) console.log(line);
            if (result.ok) {
                console.log('PASS: Order ledger matches expected math.');
            } else {
                console.log('FAIL: Ledger mismatches:');
                for (const issue of result.issues) console.log(`  - ${issue}`);
                process.exitCode = 1;
            }
        }
    } finally {
        await pool.end();
    }
}

async function main() {
    const opts = parseArgs();
    const beforeSnap = loadSnapshot(opts.beforePath);
    const afterSnap = loadSnapshot(opts.afterPath);
    printReport(beforeSnap, afterSnap, opts);

    if (opts.verifyLedger && opts.orderId) {
        await verifyOrderLedgerFromDb(opts.orderId, opts.tolerance);
    } else if (opts.orderId) {
        console.log('\nTip: add --verify-ledger to assert base + additional commission on order rows.');
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
