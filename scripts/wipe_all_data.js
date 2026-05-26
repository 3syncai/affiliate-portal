/* eslint-disable no-console */
/**
 * Wipe All Affiliate Portal Data
 *
 * Empties every affiliate-portal-owned table (transactional ledgers, role
 * accounts, and configuration), and unlinks Medusa customers from agents by
 * stripping `metadata.referral_code`. Schema (tables, columns, FKs, indexes,
 * triggers) is left fully intact.
 *
 * Usage:
 *   node scripts/wipe_all_data.js --confirm WIPE_EVERYTHING
 *   node scripts/wipe_all_data.js --dry-run
 *
 * Reads connection from process.env.DATABASE_URL (or NEXT_PUBLIC_DATABASE_URL).
 * The whole operation runs in one transaction — if anything fails, nothing is
 * applied.
 */

const { Pool } = require("pg");

// ──────────────────────────────────────────────────────────────────────
// Argument parsing
// ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const forceWithActive = argv.includes("--force-with-active-connections");
const confirmIdx = argv.indexOf("--confirm");
const confirmValue = confirmIdx >= 0 ? argv[confirmIdx + 1] : null;
const REQUIRED_CONFIRM_TOKEN = "WIPE_EVERYTHING";

function printUsageAndExit(exitCode) {
    console.log(
        [
            "",
            "Wipe All Affiliate Portal Data",
            "",
            "Usage:",
            "  node scripts/wipe_all_data.js --confirm WIPE_EVERYTHING",
            "  node scripts/wipe_all_data.js --dry-run",
            "",
            "Flags:",
            "  --confirm WIPE_EVERYTHING        Required for an actual wipe.",
            "  --dry-run                        Print row counts and the SQL",
            "                                   that would run, but do not",
            "                                   execute it.",
            "  --force-with-active-connections  Run even if other clients are",
            "                                   connected to the database.",
            "                                   Without this flag the script",
            "                                   refuses to run while Medusa or",
            "                                   the affiliate-portal dev server",
            "                                   are up, because they refill the",
            "                                   wiped tables within seconds.",
            "",
            "Required env:",
            "  DATABASE_URL  (or NEXT_PUBLIC_DATABASE_URL)",
            "",
        ].join("\n")
    );
    process.exit(exitCode);
}

if (!dryRun && confirmValue !== REQUIRED_CONFIRM_TOKEN) {
    console.error(
        `\nRefusing to run: pass --confirm ${REQUIRED_CONFIRM_TOKEN} to perform the wipe, or --dry-run to preview.\n`
    );
    printUsageAndExit(1);
}

// ──────────────────────────────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────────────────────────────

const rawConnectionString =
    process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

if (!rawConnectionString) {
    console.error(
        "\nDATABASE_URL is not set. Export it (or NEXT_PUBLIC_DATABASE_URL) and try again.\n"
    );
    process.exit(1);
}

// Drop the `sslmode` query param if present — node-postgres reads SSL from
// the explicit `ssl` option below, and some Postgres setups reject sslmode
// query params they don't understand.
const connectionString = rawConnectionString.replace(/\?sslmode=[^&]*/g, "");

function dbHostFor(connStr) {
    try {
        const u = new URL(connStr);
        return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname || ""}`;
    } catch {
        return "<unparsable connection string>";
    }
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("rds.amazonaws.com")
        ? { rejectUnauthorized: false }
        : false,
});

// ──────────────────────────────────────────────────────────────────────
// Tables to wipe — ordered most-dependent first.
// ──────────────────────────────────────────────────────────────────────
// Order is for human readability and a clean output table. TRUNCATE ... CASCADE
// makes the actual execution order safe regardless.

const TABLES_TO_WIPE = [
    // Transactional ledgers
    "withdrawal_request",
    "affiliate_commission_log",
    "customer_wallet",
    "admin_payments",
    "activity_log",
    "notifications",
    "affiliate_referrals",
    // Role / user accounts
    "branch_admin",
    "area_sales_manager",
    "state_admin",
    "affiliate_user",
    "affiliate_admin",
    "admin_users",
    // Configuration
    "commission_rates",
    "affiliate_commission",
    "additional_commissions",
    "stores",
    "app_settings",
    "product_commissions", // legacy; may not exist
    // Medusa-side custom-module tables (affiliate-related only).
    // Each is gated by the DO/EXCEPTION block below so missing tables
    // are silently skipped. wallet_*/vendor_*/user_preference are
    // intentionally excluded — they may be tied to orders/fulfillment.
    "affiliate_agent",
    "customer_affiliate",
    "customer_referral",
    "branch_admin_referrals",
    "additional_commission_offer",
    "additional_commission_offer_admin",
    "additional_commission_settings",
    "product_commission",
];

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

async function tableExists(client, tableName) {
    const res = await client.query(
        `SELECT EXISTS (
             SELECT 1
             FROM information_schema.tables
             WHERE table_schema = current_schema()
               AND table_name = $1
         ) AS present`,
        [tableName]
    );
    return res.rows[0].present;
}

async function safeRowCount(client, tableName) {
    if (!(await tableExists(client, tableName))) return null;
    try {
        const res = await client.query(
            `SELECT COUNT(*)::bigint AS c FROM ${quoteIdent(tableName)}`
        );
        return Number(res.rows[0].c);
    } catch (err) {
        return `error: ${err.message}`;
    }
}

function quoteIdent(name) {
    // Defense-in-depth: only allow simple identifiers in our static list.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Refusing to quote unsafe identifier: ${name}`);
    }
    return `"${name}"`;
}

async function checkActiveConnections(client) {
    const res = await client.query(`
        SELECT
            COALESCE(NULLIF(application_name, ''), '<unnamed>') AS application_name,
            COALESCE(client_addr::text, 'local')                AS client_addr,
            COALESCE(state, '<no-state>')                       AS state,
            COUNT(*)::int                                       AS c
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
        GROUP BY application_name, client_addr, state
        ORDER BY c DESC, application_name ASC
    `);
    return res.rows;
}

function printRowCountTable(label, counts) {
    console.log(`\n${label}`);
    console.log("─".repeat(60));
    const nameW = Math.max(...TABLES_TO_WIPE.map((t) => t.length), 30);
    for (const t of TABLES_TO_WIPE) {
        const v = counts[t];
        const display =
            v === null ? "(table not present)" : typeof v === "number" ? v.toLocaleString() : v;
        console.log(`  ${t.padEnd(nameW)}  ${display}`);
    }
    console.log("─".repeat(60));
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();

    console.log("\n==================================================");
    console.log("  Affiliate Portal — Data Wipe");
    console.log("==================================================");
    console.log(`Target DB:  ${dbHostFor(connectionString)}`);
    console.log(`Mode:       ${dryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);
    console.log("==================================================");

    try {
        // ── 0. Pre-flight: refuse to run if other clients are connected.
        // Without this, a live Medusa or affiliate-portal dev server will
        // repopulate the wiped tables seconds after COMMIT — which is
        // exactly what happened on the previous run.
        const activeRows = await checkActiveConnections(client);
        if (activeRows.length > 0) {
            console.log("\nOther active connections to this database:");
            console.log("─".repeat(60));
            const appW = Math.max(
                ...activeRows.map((r) => r.application_name.length),
                20
            );
            const addrW = Math.max(
                ...activeRows.map((r) => r.client_addr.length),
                15
            );
            for (const row of activeRows) {
                console.log(
                    `  · ${row.application_name.padEnd(appW)}  ` +
                        `${row.client_addr.padEnd(addrW)}  ` +
                        `${row.state.padEnd(20)}  ×${row.c}`
                );
            }
            console.log("─".repeat(60));

            if (!dryRun && !forceWithActive) {
                console.error(
                    "\nRefusing to wipe while other clients are connected.\n" +
                        "They will refill the wiped tables seconds after COMMIT\n" +
                        "(this is what happened on your previous run — see the\n" +
                        "operational tables that came back).\n\n" +
                        "Fix:\n" +
                        "  1. Ctrl+C the Medusa server (localhost:9000).\n" +
                        "  2. Ctrl+C the affiliate-portal dev server (localhost:3001).\n" +
                        "  3. Close any psql / pgAdmin / DB-GUI sessions on this DB.\n" +
                        "  4. Re-run this script.\n\n" +
                        "Or pass --force-with-active-connections to override (not recommended).\n"
                );
                process.exit(2);
            }

            if (forceWithActive) {
                console.log(
                    "\n--force-with-active-connections supplied — proceeding anyway.\n" +
                        "Expect operational tables to repopulate immediately after commit."
                );
            }
        } else {
            console.log(
                "\nNo other clients are connected. Safe to proceed."
            );
        }

        // ── 1. Before snapshot ────────────────────────────────────────
        const before = {};
        for (const t of TABLES_TO_WIPE) {
            before[t] = await safeRowCount(client, t);
        }
        printRowCountTable("BEFORE — row counts", before);

        // Also snapshot how many Medusa customers have a referral linked.
        let referredCustomerCount = null;
        if (await tableExists(client, "customer")) {
            try {
                const r = await client.query(
                    `SELECT COUNT(*)::bigint AS c
                     FROM customer
                     WHERE metadata ? 'referral_code'`
                );
                referredCustomerCount = Number(r.rows[0].c);
            } catch (err) {
                referredCustomerCount = `error: ${err.message}`;
            }
        }
        console.log(
            `\nMedusa customers linked to an agent (metadata.referral_code present): ${referredCustomerCount === null ? "(customer table not present)" : referredCustomerCount}`
        );

        if (dryRun) {
            console.log("\nDRY RUN — SQL that would execute:");
            console.log("─".repeat(60));
            console.log("-- Pre-flight: refuse to run if other clients are connected");
            console.log("-- (unless --force-with-active-connections is passed).");
            console.log("SELECT application_name, client_addr, state, COUNT(*)");
            console.log("FROM pg_stat_activity");
            console.log("WHERE datname = current_database()");
            console.log("  AND pid <> pg_backend_pid()");
            console.log("GROUP BY application_name, client_addr, state;");
            console.log("");
            console.log("BEGIN;");
            for (const t of TABLES_TO_WIPE) {
                console.log(
                    `DO $$ BEGIN EXECUTE 'TRUNCATE TABLE ${quoteIdent(t)} RESTART IDENTITY CASCADE'; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'skipped: ${t} does not exist'; END $$;`
                );
            }
            console.log(
                "UPDATE customer SET metadata = metadata - 'referral_code' WHERE metadata ? 'referral_code';"
            );
            console.log("COMMIT;");
            console.log("");
            console.log("-- Post-commit: sleep 3s, then re-count every wiped");
            console.log("-- table. Any non-zero count means a writer is still");
            console.log("-- active and the wipe will not stick.");
            for (const t of TABLES_TO_WIPE) {
                console.log(
                    `SELECT '${t}' AS table_name, COUNT(*) FROM ${quoteIdent(t)};`
                );
            }
            console.log("─".repeat(60));
            console.log(
                `\nTables that would be wiped (${TABLES_TO_WIPE.length}):`
            );
            for (const t of TABLES_TO_WIPE) {
                console.log(`  · ${t}`);
            }
            console.log("\nDry run complete. No changes were made.\n");
            return;
        }

        // ── 2. Single transaction: wipe + unlink ──────────────────────
        console.log("\nStarting transaction…");
        await client.query("BEGIN");

        for (const t of TABLES_TO_WIPE) {
            const sql = `
                DO $$
                BEGIN
                    EXECUTE 'TRUNCATE TABLE ${quoteIdent(t)} RESTART IDENTITY CASCADE';
                EXCEPTION WHEN undefined_table THEN
                    RAISE NOTICE 'skipped: % does not exist', '${t}';
                END $$;
            `;
            try {
                await client.query(sql);
                const after = await safeRowCount(client, t);
                const beforeVal = before[t];
                if (after === null) {
                    console.log(`  · ${t.padEnd(30)} skipped (not present)`);
                } else {
                    console.log(
                        `  · ${t.padEnd(30)} cleared (${typeof beforeVal === "number" ? beforeVal.toLocaleString() : beforeVal} → 0)`
                    );
                }
            } catch (err) {
                console.error(`  ✗ ${t}: ${err.message}`);
                throw err;
            }
        }

        // ── 3. Unlink Medusa customers (UPDATE, no DELETE) ────────────
        let unlinkedCount = 0;
        if (await tableExists(client, "customer")) {
            const upd = await client.query(
                `UPDATE customer
                 SET metadata = metadata - 'referral_code'
                 WHERE metadata ? 'referral_code'`
            );
            unlinkedCount = upd.rowCount || 0;
            console.log(
                `\n  · customer.metadata.referral_code  cleared on ${unlinkedCount.toLocaleString()} customer row(s)`
            );
        } else {
            console.log(
                "\n  · customer table not present in this DB — skipping unlink step"
            );
        }

        await client.query("COMMIT");
        console.log("\nTransaction committed.");

        // ── 4. After snapshot ─────────────────────────────────────────
        const after = {};
        for (const t of TABLES_TO_WIPE) {
            after[t] = await safeRowCount(client, t);
        }
        printRowCountTable("AFTER — row counts (immediately after commit)", after);

        // ── 4b. Verify the wipe stuck. Wait 3s and re-count — if a
        // writer (Medusa subscribers, sync job, app seeder) is still
        // active it will have refilled at least one table by now.
        console.log(
            "\nWaiting 3s to check if anything is repopulating the tables…"
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const afterDelay = {};
        for (const t of TABLES_TO_WIPE) {
            afterDelay[t] = await safeRowCount(client, t);
        }

        const repopulated = TABLES_TO_WIPE.filter((t) => {
            const v = afterDelay[t];
            return typeof v === "number" && v > 0;
        });

        if (repopulated.length === 0) {
            console.log(
                "Verified: every wiped table is still empty 3s after commit."
            );
        } else {
            console.log("\n" + "!".repeat(60));
            console.log(
                "WARNING — the following tables already have rows again:"
            );
            console.log("!".repeat(60));
            for (const t of repopulated) {
                const v = afterDelay[t];
                console.log(
                    `  · ${t.padEnd(34)} ${v.toLocaleString()} row(s)`
                );
            }
            console.log("!".repeat(60));
            console.log(
                "A writer is still active. Likely culprits:\n" +
                    "  - Medusa server (localhost:9000) — subscribers/webhooks insert\n" +
                    "    rows into affiliate_commission_log, affiliate_commission, etc.\n" +
                    "  - affiliate-portal dev server (localhost:3001) — lib/affiliate-\n" +
                    "    commission-sync.ts plus first-request seeders re-create\n" +
                    "    customer_wallet, commission_rates, app_settings, stores, etc.\n\n" +
                    "Fix: stop both servers, then re-run this script.\n"
            );
        }

        // ── 5. Follow-up notes ────────────────────────────────────────
        console.log("\nFollow-up notes:");
        console.log("─".repeat(60));
        console.log(
            "1. `affiliate_commission_log` can refill from Medusa orders:"
        );
        console.log(
            "     - Medusa subscriber + storefront webhook insert rows on order events"
        );
        console.log(
            "     - lib/affiliate-commission-sync.ts runs on every wallet/stats request"
        );
        console.log(
            "   Stop those pipelines (or re-run this script) if you need it to stay empty."
        );
        console.log(
            "\n2. No one can log in — the head admin (`affiliate_admin`) is empty."
        );
        console.log(
            "   Re-seed via `node restore_admin.js` or INSERT a row into `affiliate_admin`."
        );
        console.log(
            "\n3. Schema is untouched. No tables, columns, FKs, indexes, or triggers"
        );
        console.log(
            "   were dropped or altered. The commission-unlock trigger remains active."
        );
        console.log(
            "\n4. Medusa customers and their order history were NOT deleted."
        );
        console.log(
            `   Only metadata.referral_code was stripped from ${unlinkedCount.toLocaleString()} row(s).`
        );
        console.log("─".repeat(60));
        console.log("\nDone.\n");
    } catch (err) {
        // Roll back if a transaction is open
        try {
            await client.query("ROLLBACK");
            console.error("\nTransaction rolled back. No changes were applied.");
        } catch {
            /* ignore — connection may already be broken */
        }
        console.error("\nWipe failed:", err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
