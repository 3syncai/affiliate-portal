/* eslint-disable no-console */
/**
 * Clear ASM / BM / State Head earnings activity (commission rows + wallets).
 * Keeps admin accounts; does not delete SE data unless --all-commissions.
 *
 * Usage:
 *   node scripts/clear_admin_earnings_activity.js
 *   node scripts/clear_admin_earnings_activity.js --confirm
 *   node scripts/clear_admin_earnings_activity.js --confirm --all-commissions
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function readDotEnv() {
    const envPath = path.join(__dirname, "..", ".env");
    const out = {};
    if (!fs.existsSync(envPath)) return out;
    for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const dryRun = !process.argv.includes("--confirm");
const allCommissions = process.argv.includes("--all-commissions");

const ADMIN_SOURCES = [
    "branch_admin",
    "area_manager",
    "asm_direct",
    "state_admin",
    "state_admin_direct",
];

const pool = new Pool({
    connectionString: readDotEnv().DATABASE_URL || readDotEnv().NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function preview() {
    const bySource = await pool.query(
        `SELECT commission_source, status, COUNT(*)::int AS c,
                COALESCE(SUM(affiliate_commission), 0) AS total
         FROM affiliate_commission_log
         WHERE commission_source = ANY($1::text[])
         GROUP BY commission_source, status
         ORDER BY commission_source, status`,
        [ADMIN_SOURCES]
    );

    const affiliateRows = await pool.query(
        `SELECT COUNT(*)::int AS c FROM affiliate_commission_log WHERE commission_source = 'affiliate'`
    );

    const wallets = await pool.query(
        `
        SELECT 'branch_admin' AS role, ba.first_name, ba.last_name, COALESCE(cw.coins_balance, 0) AS balance
        FROM branch_admin ba
        LEFT JOIN customer_wallet cw ON cw.customer_id = ba.id::text
        WHERE COALESCE(cw.coins_balance, 0) <> 0
        UNION ALL
        SELECT 'area_sales_manager', asm.first_name, asm.last_name, COALESCE(cw.coins_balance, 0)
        FROM area_sales_manager asm
        LEFT JOIN customer_wallet cw ON cw.customer_id = asm.id::text
        WHERE COALESCE(cw.coins_balance, 0) <> 0
        UNION ALL
        SELECT 'state_admin', sa.first_name, sa.last_name, COALESCE(cw.coins_balance, 0)
        FROM state_admin sa
        LEFT JOIN customer_wallet cw ON cw.customer_id = sa.id::text
        WHERE COALESCE(cw.coins_balance, 0) <> 0
        `
    );

    const payments = await pool.query(
        `SELECT recipient_type, COUNT(*)::int AS c
         FROM admin_payments
         WHERE recipient_type IN ('branch', 'asm', 'state')
         GROUP BY recipient_type`
    );

    return { bySource: bySource.rows, affiliateRows: affiliateRows.rows[0], wallets: wallets.rows, payments: payments.rows };
}

async function execute(client) {
    const deleted = {};

    if (allCommissions) {
        deleted.all_commission_log = (
            await client.query("DELETE FROM affiliate_commission_log RETURNING id")
        ).rowCount;
    } else {
        deleted.admin_commission_log = (
            await client.query(
                "DELETE FROM affiliate_commission_log WHERE commission_source = ANY($1::text[]) RETURNING id",
                [ADMIN_SOURCES]
            )
        ).rowCount;
    }

    const baIds = await client.query("SELECT id::text AS id FROM branch_admin");
    const asmIds = await client.query("SELECT id::text AS id FROM area_sales_manager");
    const saIds = await client.query("SELECT id::text AS id FROM state_admin");
    const allAdminIds = [
        ...baIds.rows.map((r) => r.id),
        ...asmIds.rows.map((r) => r.id),
        ...saIds.rows.map((r) => r.id),
    ];

    if (allAdminIds.length > 0) {
        deleted.customer_wallet_reset = (
            await client.query(
                `UPDATE customer_wallet SET coins_balance = 0
                 WHERE customer_id = ANY($1::text[])`,
                [allAdminIds]
            )
        ).rowCount;
    }

    deleted.admin_payments = (
        await client.query(
            `DELETE FROM admin_payments WHERE recipient_type IN ('branch', 'asm', 'state') RETURNING id`
        )
    ).rowCount;

    return deleted;
}

async function main() {
    const previewData = await preview();

    console.log(`Mode: ${dryRun ? "DRY RUN" : "CLEAR"}`);
    console.log(`Scope: ${allCommissions ? "ALL commission log rows" : "ASM/BM/State admin sources only"}\n`);

    console.log("=== Admin commission rows by source ===");
    if (previewData.bySource.length === 0) {
        console.log("  (none)");
    } else {
        console.table(previewData.bySource);
    }

    console.log(`\nSE affiliate rows (unchanged unless --all-commissions): ${previewData.affiliateRows.c}`);

    console.log("\n=== Non-zero admin wallets ===");
    if (previewData.wallets.length === 0) {
        console.log("  (all zero)");
    } else {
        console.table(previewData.wallets);
    }

    console.log("\n=== Admin payments ===");
    if (previewData.payments.length === 0) {
        console.log("  (none)");
    } else {
        console.table(previewData.payments);
    }

    const nothing =
        previewData.bySource.length === 0 &&
        previewData.wallets.length === 0 &&
        previewData.payments.length === 0 &&
        (!allCommissions || previewData.affiliateRows.c === 0);

    if (nothing) {
        console.log("\nNothing to clear — admin earnings already empty.");
        return;
    }

    if (dryRun) {
        console.log("\nDry run only. Re-run with --confirm to clear.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const deleted = await execute(client);
        await client.query("COMMIT");
        console.log("\nCleared:");
        console.table(Object.entries(deleted).map(([table, count]) => ({ table, count })));
        console.log("\nRefresh /branch/earnings, /asm/earnings, and /state-admin/earnings.");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

main()
    .catch((e) => {
        console.error("Failed:", e.message || e);
        process.exit(1);
    })
    .finally(() => pool.end());
