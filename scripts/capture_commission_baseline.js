/* eslint-disable */
/**
 * Capture commission baseline for sub-admin test accounts (DB + local API).
 *
 * Usage:
 *   node scripts/capture_commission_baseline.js
 *   node scripts/capture_commission_baseline.js --label phase1 --output scripts/baseline-phase1.json
 *
 * Env:
 *   DATABASE_URL, BASE_URL (default http://localhost:3001)
 *
 * Commission math reference (₹1000 @ 10% product commission → pool ₹100; rates 40/30/20/10):
 *   ASM direct (branch_admin refer code):        ₹70 + ₹20 + ₹10  (3 ledger rows)
 *   Branch Head direct (area_sales_manager):   ₹90 + ₹10         (2 rows)
 *   State Head direct (state_admin):             ₹100              (1 row)
 *
 * Additional commission: only the direct seller row gets orderAmount × campaignRate%;
 * override rows (BRANCH/AREA/STATE) stay at base amounts. See commission-test-mode.json.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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

const BASE_URL = process.env.BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3001';

const TEST_ACCOUNTS = [
    { label: 'National Head', email: 'vishal@gmail.com', role: 'admin' },
    { label: 'State Head', email: 'jhakrishnachandra96@gmail.com', role: 'state' },
    { label: 'Branch Head (BM)', email: 'guptavishal0194@gmail.com', role: 'branch_manager' },
    { label: 'ASM #1', email: 'krishnaforytuse@gmail.com', role: 'asm' },
    { label: 'ASM #2', email: 'abhijeetjha913@gmail.com', role: 'asm', optional: true },
];

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false },
});

const toNum = (v) => Number.parseFloat(String(v ?? 0)) || 0;

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { label: 'snapshot', output: null };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--label' && args[i + 1]) opts.label = args[++i];
        else if (args[i] === '--output' && args[i + 1]) opts.output = args[++i];
    }
    if (!opts.output) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        opts.output = path.join(__dirname, `baseline-${opts.label}-${ts}.json`);
    }
    return opts;
}

async function fetchJson(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return { _error: `${res.status} ${res.statusText}`, _url: url };
        return res.json();
    } catch (err) {
        return { _error: err.message, _url: url };
    }
}

async function getCommissionRates() {
    const rows = (await pool.query(
        `SELECT role_type, commission_percentage FROM commission_rates ORDER BY role_type`
    )).rows;
    const rates = {};
    for (const row of rows) rates[row.role_type] = toNum(row.commission_percentage);

    const affiliate = rates.affiliate ?? 0;
    const branch = rates.branch ?? rates.branch_direct ?? 0;
    const area = rates.area ?? 0;
    const state = rates.state ?? 0;

    return {
        raw: rates,
        summary: {
            affiliate: { directRate: affiliate, overrideRate: 0 },
            branch: { directRate: affiliate + branch, overrideRate: branch },
            asm: { directRate: affiliate + branch + area, overrideRate: area },
            state: {
                directRate: Math.min(affiliate + branch + area + state, 100),
                overrideRate: state,
            },
        },
    };
}

async function ledgerBreakdown(referCode, userId) {
    const params = [];
    const clauses = [];
    if (referCode) {
        params.push(referCode);
        clauses.push(`LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM($${params.length}))`);
    }
    if (userId) {
        params.push(String(userId));
        clauses.push(`NULLIF(acl.affiliate_user_id, '') = $${params.length}::text`);
    }
    if (clauses.length === 0) return [];

    const r = await pool.query(
        `SELECT acl.commission_source, acl.status,
                COUNT(*)::int AS row_count,
                COALESCE(SUM(acl.affiliate_commission), 0) AS amount,
                COUNT(*) FILTER (WHERE acl.unlock_at IS NULL AND acl.status = 'PENDING')::int AS pending_no_unlock,
                COUNT(*) FILTER (WHERE acl.unlock_at IS NOT NULL AND acl.status = 'PENDING')::int AS pending_with_unlock
         FROM affiliate_commission_log acl
         WHERE ${clauses.join(' OR ')}
         GROUP BY acl.commission_source, acl.status
         ORDER BY 1, 2`,
        params
    );
    return r.rows.map((row) => ({
        commission_source: row.commission_source,
        status: row.status,
        row_count: row.row_count,
        amount: toNum(row.amount),
        pending_no_unlock: row.pending_no_unlock,
        pending_with_unlock: row.pending_with_unlock,
    }));
}

async function additionalCommissionTotal(referCode, userId) {
    const params = [];
    const clauses = [];
    if (referCode) {
        params.push(referCode);
        clauses.push(`LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM($${params.length}))`);
    }
    if (userId) {
        params.push(String(userId));
        clauses.push(`NULLIF(acl.affiliate_user_id, '') = $${params.length}::text`);
    }
    if (clauses.length === 0) return 0;

    const r = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(acl.additional_commission_amount, 0)), 0) AS total
         FROM affiliate_commission_log acl
         WHERE ${clauses.join(' OR ')}`,
        params
    );
    return toNum(r.rows[0]?.total);
}

function loadTestModeConfig() {
    const configPath = path.join(__dirname, 'commission-test-mode.json');
    if (!fs.existsSync(configPath)) return { mode: process.env.COMMISSION_TEST_MODE || 'base-only' };
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return { mode: 'base-only' };
    }
}

async function walletBalance(customerId) {
    if (!customerId) return null;
    const r = await pool.query(
        `SELECT coins_balance FROM customer_wallet WHERE customer_id = $1::text`,
        [String(customerId)]
    );
    return r.rows[0] ? toNum(r.rows[0].coins_balance) : 0;
}

async function resolveAccount(email) {
    const lower = email.toLowerCase();

    let r = await pool.query(
        `SELECT id::text AS id, email, refer_code, state, NULL AS city, NULL AS branch,
                first_name, last_name, 'state_admin' AS table_name
         FROM state_admin WHERE LOWER(email) = $1 LIMIT 1`,
        [lower]
    );
    if (r.rows[0]) return { ...r.rows[0], portalRole: 'state' };

    r = await pool.query(
        `SELECT id::text AS id, email, refer_code, state, city, NULL AS branch,
                first_name, last_name, 'area_sales_manager' AS table_name
         FROM area_sales_manager WHERE LOWER(email) = $1 LIMIT 1`,
        [lower]
    );
    if (r.rows[0]) return { ...r.rows[0], portalRole: 'branch_manager' };

    r = await pool.query(
        `SELECT id::text AS id, email, refer_code, state, city, branch,
                first_name, last_name, 'branch_admin' AS table_name
         FROM branch_admin WHERE LOWER(email) = $1 LIMIT 1`,
        [lower]
    );
    if (r.rows[0]) return { ...r.rows[0], portalRole: 'asm' };

    r = await pool.query(
        `SELECT id::text AS id, email, NULL AS refer_code, NULL AS state, NULL AS city, NULL AS branch,
                NULL AS first_name, NULL AS last_name, 'admin' AS table_name
         FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`,
        [lower]
    );
    if (r.rows[0]) return { ...r.rows[0], portalRole: 'admin' };

    return null;
}

async function captureStateHead(profile) {
    const q = new URLSearchParams({ state: profile.state, adminId: profile.id });
    const earnings = await fetchJson(`${BASE_URL}/api/state-admin/earnings?${q}`);
    const ledger = await ledgerBreakdown(profile.refer_code, profile.id);
    const totalAdditionalCommission = await additionalCommissionTotal(profile.refer_code, profile.id);
    const wallet = await walletBalance(profile.id);

    const recentOrders = earnings.stats ? [] : (earnings.recentOrders || []);
    const statusCounts = { PENDING: 0, CREDITED: 0, CANCELLED: 0 };
    for (const o of recentOrders) {
        if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    }

    return {
        profile: {
            email: profile.email,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            refer_code: profile.refer_code,
            state: profile.state,
        },
        earningsApi: earnings.success === false ? { error: earnings.error } : {
            lifetimeEarnings: earnings.stats?.lifetimeEarnings,
            creditedLifetimeEarnings: earnings.stats?.creditedLifetimeEarnings,
            pendingEarnings: earnings.stats?.pendingEarnings,
            currentEarnings: earnings.stats?.currentEarnings,
            availableBalance: earnings.stats?.availableBalance,
            paidAmount: earnings.stats?.paidAmount,
            earningsFromOverrides: earnings.stats?.earningsFromOverrides,
            pendingFromOverrides: earnings.stats?.pendingFromOverrides,
            earningsFromDirect: earnings.stats?.earningsFromDirect,
            pendingFromDirect: earnings.stats?.pendingFromDirect,
            overrideRate: earnings.stats?.overrideRate,
            directRate: earnings.stats?.directRate,
            recentOrderStatusCounts: statusCounts,
        },
        ledger,
        totalAdditionalCommission,
        walletBalance: wallet,
    };
}

async function captureBranchManager(profile) {
    const q = new URLSearchParams({
        city: profile.city,
        state: profile.state,
        adminId: profile.id,
    });
    const earnings = await fetchJson(`${BASE_URL}/api/asm/earnings?${q}`);
    const ledger = await ledgerBreakdown(profile.refer_code, profile.id);
    const totalAdditionalCommission = await additionalCommissionTotal(profile.refer_code, profile.id);
    const wallet = await walletBalance(profile.id);

    const recentOrders = earnings.recentOrders || [];
    const statusCounts = { PENDING: 0, CREDITED: 0, CANCELLED: 0 };
    for (const o of recentOrders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

    return {
        profile: {
            email: profile.email,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            refer_code: profile.refer_code,
            city: profile.city,
            state: profile.state,
        },
        earningsApi: earnings.success === false ? { error: earnings.error } : {
            lifetimeEarnings: earnings.stats?.lifetimeEarnings,
            creditedLifetimeEarnings: earnings.stats?.creditedLifetimeEarnings,
            pendingEarnings: earnings.stats?.pendingEarnings,
            currentEarnings: earnings.stats?.currentEarnings,
            paidAmount: earnings.stats?.paidAmount,
            earningsFromBranch: earnings.stats?.earningsFromBranch,
            pendingFromBranch: earnings.stats?.pendingFromBranch,
            earningsFromDirect: earnings.stats?.earningsFromDirect,
            pendingFromDirect: earnings.stats?.pendingFromDirect,
            overrideRate: earnings.stats?.overrideRate,
            directRate: earnings.stats?.directRate,
            recentOrderStatusCounts: statusCounts,
        },
        ledger,
        totalAdditionalCommission,
        walletBalance: wallet,
    };
}

async function captureAsm(profile) {
    const q = new URLSearchParams({ branch: profile.branch, adminId: profile.id });
    const earnings = await fetchJson(`${BASE_URL}/api/branch/earnings?${q}`);
    const ledger = await ledgerBreakdown(profile.refer_code, profile.id);
    const totalAdditionalCommission = await additionalCommissionTotal(profile.refer_code, profile.id);
    const wallet = await walletBalance(profile.id);

    const recentOrders = earnings.recentOrders || [];
    const statusCounts = { PENDING: 0, CREDITED: 0, CANCELLED: 0 };
    for (const o of recentOrders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

    return {
        profile: {
            email: profile.email,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            refer_code: profile.refer_code,
            branch: profile.branch,
            city: profile.city,
            state: profile.state,
        },
        earningsApi: earnings.success === false ? { error: earnings.error } : {
            totalEarnings: earnings.stats?.totalEarnings,
            lifetimeEarnings: earnings.stats?.lifetimeEarnings,
            creditedLifetimeEarnings: earnings.stats?.creditedLifetimeEarnings,
            pendingEarnings: earnings.stats?.pendingEarnings,
            availableBalance: earnings.stats?.availableBalance,
            currentEarnings: earnings.stats?.currentEarnings,
            paidAmount: earnings.stats?.paidAmount,
            overrideEarnings: earnings.stats?.overrideEarnings,
            pendingOverrideEarnings: earnings.stats?.pendingOverrideEarnings,
            directEarnings: earnings.stats?.directEarnings,
            pendingDirectEarnings: earnings.stats?.pendingDirectEarnings,
            overrideRate: earnings.stats?.overrideRate,
            directRate: earnings.stats?.directRate,
            recentOrderStatusCounts: statusCounts,
        },
        ledger,
        totalAdditionalCommission,
        walletBalance: wallet,
    };
}

async function captureNationalPlatform() {
    const platformRes = await fetchJson(`${BASE_URL}/api/affiliate/admin/stats`);
    const paymentsRes = await fetchJson(`${BASE_URL}/api/admin/payments/admins`);
    const platformStats = platformRes.stats || platformRes;
    const adminList = paymentsRes.admins || (Array.isArray(paymentsRes) ? paymentsRes : []);

    const testEmails = TEST_ACCOUNTS.filter((a) => a.role !== 'admin').map((a) => a.email.toLowerCase());

    const subAdminRows = [];
    for (const row of adminList) {
        if (testEmails.includes(String(row.email || '').toLowerCase())) {
            subAdminRows.push({
                email: row.email,
                admin_type: row.type || row.admin_type,
                name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
                lifetimeEarnings: toNum(row.lifetimeEarnings ?? row.lifetime_earnings),
                paidAmount: toNum(row.paidAmount ?? row.paid_amount),
                currentEarnings: toNum(row.currentEarnings ?? row.current_earnings),
                commissionRate: toNum(row.commissionRate ?? row.commission_rate),
            });
        }
    }

    return {
        platformStats: platformStats._error ? platformStats : {
            totalCommission: platformStats.totalCommission,
            pendingPayout: platformStats.pendingPayout,
            totalOrders: platformStats.totalOrders,
            totalReturns: platformStats.totalReturns,
            totalAgents: platformStats.totalAgents,
        },
        subAdminPayoutView: subAdminRows,
    };
}

async function captureAccount(entry) {
    if (entry.role === 'admin') {
        return { label: entry.label, role: entry.role, national: await captureNationalPlatform() };
    }

    const profile = await resolveAccount(entry.email);
    if (!profile) {
        return {
            label: entry.label,
            email: entry.email,
            error: entry.optional
                ? 'Account not found in DB (optional test account)'
                : 'Account not found in DB',
        };
    }

    let data;
    if (profile.portalRole === 'state') data = await captureStateHead(profile);
    else if (profile.portalRole === 'branch_manager') data = await captureBranchManager(profile);
    else if (profile.portalRole === 'asm') data = await captureAsm(profile);
    else data = { error: `Unknown portal role ${profile.portalRole}` };

    return { label: entry.label, role: entry.role, ...data };
}

function printSummary(snapshot) {
    console.log('\n=== Commission Baseline Summary ===');
    console.log(`Label: ${snapshot.meta.label}`);
    console.log(`Captured: ${snapshot.meta.capturedAt}`);
    console.log(`Rates: affiliate=${snapshot.commissionRates.raw.affiliate}% branch=${snapshot.commissionRates.raw.branch}% area=${snapshot.commissionRates.raw.area}% state=${snapshot.commissionRates.raw.state}%`);

    if (snapshot.national?.platformStats) {
        const p = snapshot.national.platformStats;
        console.log('\n[National Head — platform]');
        console.log(`  totalCommission: ₹${toNum(p.totalCommission).toFixed(2)}`);
        console.log(`  totalOrders: ${p.totalOrders}  totalReturns: ${p.totalReturns}`);
    }

    for (const acct of snapshot.accounts) {
        if (acct.national) continue;
        console.log(`\n[${acct.label}] ${acct.profile?.email || acct.email || '?'}`);
        if (acct.error) {
            console.log(`  ERROR: ${acct.error}`);
            continue;
        }
        const e = acct.earningsApi || {};
        if (e.error) {
            console.log(`  API ERROR: ${e.error}`);
            continue;
        }
        console.log(`  refer_code: ${acct.profile?.refer_code || '—'}`);
        console.log(`  lifetime/total: ₹${toNum(e.lifetimeEarnings ?? e.totalEarnings).toFixed(2)}`);
        console.log(`  credited: ₹${toNum(e.creditedLifetimeEarnings).toFixed(2)}  pending: ₹${toNum(e.pendingEarnings).toFixed(2)}`);
        console.log(`  available/current: ₹${toNum(e.currentEarnings ?? e.availableBalance).toFixed(2)}  paid: ₹${toNum(e.paidAmount).toFixed(2)}`);
        if (e.pendingFromDirect !== undefined) {
            console.log(`  direct — credited: ₹${toNum(e.earningsFromDirect).toFixed(2)} pending: ₹${toNum(e.pendingFromDirect).toFixed(2)}`);
        }
        if (e.pendingFromOverrides !== undefined) {
            console.log(`  override — credited: ₹${toNum(e.earningsFromOverrides).toFixed(2)} pending: ₹${toNum(e.pendingFromOverrides).toFixed(2)}`);
        }
        if (e.pendingOverrideEarnings !== undefined) {
            console.log(`  override — credited: ₹${toNum(e.overrideEarnings).toFixed(2)} pending: ₹${toNum(e.pendingOverrideEarnings).toFixed(2)}`);
        }
        if (e.pendingFromBranch !== undefined) {
            console.log(`  branch override — credited: ₹${toNum(e.earningsFromBranch).toFixed(2)} pending: ₹${toNum(e.pendingFromBranch).toFixed(2)}`);
        }
        console.log(`  wallet: ₹${toNum(acct.walletBalance).toFixed(2)}`);
        if (acct.totalAdditionalCommission !== undefined) {
            console.log(`  additional commission (ledger sum): ₹${toNum(acct.totalAdditionalCommission).toFixed(2)}`);
        }
        if (acct.ledger?.length) {
            console.log('  ledger:');
            for (const row of acct.ledger) {
                console.log(`    ${row.commission_source}/${row.status}: ${row.row_count} rows ₹${row.amount.toFixed(2)} (no_unlock=${row.pending_no_unlock}, countdown=${row.pending_with_unlock})`);
            }
        }
    }
}

async function main() {
    const opts = parseArgs();
    const commissionRates = await getCommissionRates();
    const testModeConfig = loadTestModeConfig();

    const accounts = [];
    for (const entry of TEST_ACCOUNTS) {
        accounts.push(await captureAccount(entry));
    }

    const nationalEntry = accounts.find((a) => a.national);
    const snapshot = {
        meta: {
            label: opts.label,
            capturedAt: new Date().toISOString(),
            baseUrl: BASE_URL,
            testMode: process.env.COMMISSION_TEST_MODE || testModeConfig.mode || 'base-only',
        },
        commissionRates,
        national: nationalEntry?.national || null,
        accounts: accounts.filter((a) => !a.national),
    };

    fs.writeFileSync(opts.output, JSON.stringify(snapshot, null, 2));
    printSummary(snapshot);
    console.log(`\nSaved: ${opts.output}`);
    return opts.output;
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
