/* eslint-disable no-console */
/**
 * Scoped cleanup for commission-math test accounts (dry run by default).
 *
 * Clears order-linked commission rows, returns, scoped admin_payments, and
 * resets wallets for test emails only — other admins on the DB are untouched.
 *
 * Usage:
 *   node scripts/reset_test_accounts_commission_math.js
 *   node scripts/reset_test_accounts_commission_math.js --confirm
 *   node scripts/reset_test_accounts_commission_math.js --confirm --include-orders
 *   node scripts/reset_test_accounts_commission_math.js --confirm --include-referrals
 *
 * affiliate_referrals are NOT deleted by default (use --include-referrals).
 * Deleting them removes customers from SE "My Referrals" without clearing checkout attribution.
 * Commission math reference (₹1000 @ 10% pool = ₹100; rates 40/30/20/10):
 *   ASM direct (branch_admin code):     ₹70 + ₹20 + ₹10  (3 rows)
 *   Branch Head direct (area_sales_manager): ₹90 + ₹10 (2 rows)
 *   State Head direct:                  ₹100 (1 row)
 *
 * Additional commission: direct seller row only (+orderAmount × campaignRate%).
 * Override rows (BRANCH/AREA/STATE) stay at base amounts. See commission-test-mode.json.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const TEST_EMAILS = [
    "jhakrishnachandra96@gmail.com",
    "guptavishal0194@gmail.com",
    "krishnaforytuse@gmail.com",
    "abhijeetjha913@gmail.com",
];

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
            const line = rawLine.replace(/\r$/, "").trim();
            if (!line || line.startsWith("#")) continue;
            if (line.startsWith("DATABASE_URL=")) {
                return line.slice("DATABASE_URL=".length).trim();
            }
        }
    }
    return "";
}

const dryRun = !process.argv.includes("--confirm");
const includeOrders = process.argv.includes("--include-orders");
const includeReferrals = process.argv.includes("--include-referrals");

const pool = new Pool({
    connectionString: loadDatabaseUrl().replace("?sslmode=no-verify", ""),
    ssl: { rejectUnauthorized: false },
});

async function resolveTestAccounts(client) {
    const accounts = [];

    for (const email of TEST_EMAILS) {
        const lower = email.toLowerCase();

        const state = await client.query(
            `SELECT id::text AS id, email, refer_code, 'state_admin' AS table_name, 'state' AS portal_role
             FROM state_admin WHERE LOWER(email) = $1 LIMIT 1`,
            [lower]
        );
        if (state.rows[0]) {
            accounts.push(state.rows[0]);
            continue;
        }

        const bm = await client.query(
            `SELECT id::text AS id, email, refer_code, 'area_sales_manager' AS table_name, 'branch_manager' AS portal_role
             FROM area_sales_manager WHERE LOWER(email) = $1 LIMIT 1`,
            [lower]
        );
        if (bm.rows[0]) {
            accounts.push(bm.rows[0]);
            continue;
        }

        const asm = await client.query(
            `SELECT id::text AS id, email, refer_code, 'branch_admin' AS table_name, 'asm' AS portal_role
             FROM branch_admin WHERE LOWER(email) = $1 LIMIT 1`,
            [lower]
        );
        if (asm.rows[0]) {
            accounts.push(asm.rows[0]);
            continue;
        }

        const se = await client.query(
            `SELECT id::text AS id, email, refer_code, 'affiliate_user' AS table_name, 'sales_executive' AS portal_role
             FROM affiliate_user WHERE LOWER(email) = $1 LIMIT 1`,
            [lower]
        );
        if (se.rows[0]) {
            accounts.push(se.rows[0]);
            continue;
        }

        accounts.push({ email, missing: true });
    }

    return accounts;
}

async function collectScope(client, accounts) {
    const resolved = accounts.filter((a) => !a.missing);
    const referCodes = resolved.map((a) => a.refer_code).filter(Boolean);
    const adminIds = resolved
        .filter((a) => a.table_name !== "affiliate_user")
        .map((a) => a.id);
    const seUsers = resolved.filter((a) => a.table_name === "affiliate_user");
    const seIds = seUsers.map((a) => a.id);
    const seReferCodes = seUsers.map((a) => a.refer_code).filter(Boolean);
    const allWalletIds = resolved.map((a) => a.id);

    const orderIdsResult = await client.query(
        `SELECT DISTINCT order_id
         FROM affiliate_commission_log
         WHERE (
             LOWER(TRIM(affiliate_code)) = ANY($1::text[])
             OR NULLIF(affiliate_user_id, '') = ANY($2::text[])
         )
         AND order_id IS NOT NULL
         AND TRIM(order_id) <> ''`,
        [
            referCodes.map((c) => c.toLowerCase()),
            [...adminIds, ...seIds],
        ]
    );
    const orderIds = orderIdsResult.rows.map((r) => r.order_id).filter(Boolean);

    let commissionByOrder = { rows: [] };
    if (orderIds.length > 0) {
        commissionByOrder = await client.query(
            `SELECT id, order_id, affiliate_code, commission_source, affiliate_user_id,
                    affiliate_commission, status
             FROM affiliate_commission_log
             WHERE order_id = ANY($1::text[])
             ORDER BY order_id, commission_source`,
            [orderIds]
        );
    }

    const orphanCommissions = await client.query(
        `SELECT id, order_id, affiliate_code, commission_source, affiliate_commission, status
         FROM affiliate_commission_log
         WHERE (
             LOWER(TRIM(affiliate_code)) = ANY($1::text[])
             OR NULLIF(affiliate_user_id, '') = ANY($2::text[])
         )
         AND (order_id IS NULL OR NOT (order_id = ANY($3::text[])))`,
        [
            referCodes.map((c) => c.toLowerCase()),
            [...adminIds, ...seIds],
            orderIds.length ? orderIds : [""],
        ]
    );

    let returns = { rows: [] };
    if (orderIds.length > 0) {
        try {
            returns = await client.query(
                `SELECT id, order_id, status FROM return_request WHERE order_id = ANY($1::text[])`,
                [orderIds]
            );
        } catch {
            /* optional */
        }
    }

    let adminPayments = { rows: [] };
    if (adminIds.length > 0) {
        adminPayments = await client.query(
            `SELECT id, recipient_id, recipient_type, amount, status
             FROM admin_payments
             WHERE recipient_id::text = ANY($1::text[])`,
            [adminIds]
        );
    }

    let wallets = { rows: [] };
    if (allWalletIds.length > 0) {
        wallets = await client.query(
            `SELECT customer_id, coins_balance FROM customer_wallet WHERE customer_id = ANY($1::text[])`,
            [allWalletIds]
        );
    }

    let withdrawals = { rows: [] };
    if (seIds.length > 0 || seReferCodes.length > 0) {
        withdrawals = await client.query(
            `SELECT id, affiliate_id, affiliate_code, withdrawal_amount, status
             FROM withdrawal_request
             WHERE affiliate_id::text = ANY($1::text[])
                OR LOWER(TRIM(affiliate_code)) = ANY($2::text[])`,
            [seIds, seReferCodes.map((c) => c.toLowerCase())]
        );
    }

    let referrals = { rows: [] };
    if (seReferCodes.length > 0) {
        referrals = await client.query(
            `SELECT id, affiliate_code, customer_email FROM affiliate_referrals
             WHERE LOWER(TRIM(affiliate_code)) = ANY($1::text[])`,
            [seReferCodes.map((c) => c.toLowerCase())]
        );
    }

    const remainingAfter = await client.query(
        `SELECT commission_source, status, COUNT(*)::int AS c,
                COALESCE(SUM(affiliate_commission), 0) AS total
         FROM affiliate_commission_log
         WHERE LOWER(TRIM(affiliate_code)) = ANY($1::text[])
            OR NULLIF(affiliate_user_id, '') = ANY($2::text[])
         GROUP BY commission_source, status`,
        [
            referCodes.map((c) => c.toLowerCase()),
            [...adminIds, ...seIds],
        ]
    );

    return {
        resolved,
        referCodes,
        adminIds,
        seUsers,
        seIds,
        seReferCodes,
        allWalletIds,
        orderIds,
        commissionByOrder,
        orphanCommissions,
        returns,
        adminPayments,
        wallets,
        withdrawals,
        referrals,
        remainingAfter,
    };
}

async function reverseWalletForRow(client, row) {
    if (row.status !== "CREDITED") return false;
    const amount = Number.parseFloat(String(row.affiliate_commission ?? 0)) || 0;
    if (amount <= 0) return false;

    let customerId = String(row.affiliate_user_id ?? "").trim();
    if (!customerId && row.commission_source === "affiliate") {
        const userRow = await client.query(
            "SELECT id::text AS id FROM affiliate_user WHERE refer_code = $1 LIMIT 1",
            [row.affiliate_code]
        );
        customerId = userRow.rows[0]?.id ?? "";
    }
    if (!customerId) return false;

    await client.query(
        `UPDATE customer_wallet
         SET coins_balance = GREATEST(0, coins_balance - $2)
         WHERE customer_id = $1::text`,
        [customerId, amount]
    );
    return true;
}

async function executeCleanup(client, scope) {
    const {
        orderIds,
        referCodes,
        adminIds,
        seIds,
        seReferCodes,
        allWalletIds,
        commissionByOrder,
        orphanCommissions,
    } = scope;

    const deleted = { wallet_reversals: 0 };

    for (const row of commissionByOrder.rows) {
        if (await reverseWalletForRow(client, row)) deleted.wallet_reversals += 1;
    }
    for (const row of orphanCommissions.rows) {
        if (await reverseWalletForRow(client, row)) deleted.wallet_reversals += 1;
    }

    if (orderIds.length > 0) {
        try {
            deleted.return_request = (
                await client.query(
                    "DELETE FROM return_request WHERE order_id = ANY($1::text[]) RETURNING id",
                    [orderIds]
                )
            ).rowCount;
        } catch {
            deleted.return_request = 0;
        }

        deleted.commission_by_order = (
            await client.query(
                "DELETE FROM affiliate_commission_log WHERE order_id = ANY($1::text[]) RETURNING id",
                [orderIds]
            )
        ).rowCount;

        if (includeOrders) {
            deleted.orders = (
                await client.query(`DELETE FROM "order" WHERE id = ANY($1::text[]) RETURNING id`, [
                    orderIds,
                ])
            ).rowCount;
        }
    }

    if (referCodes.length > 0 || adminIds.length > 0 || seIds.length > 0) {
        deleted.commission_orphans = (
            await client.query(
                `DELETE FROM affiliate_commission_log
                 WHERE LOWER(TRIM(affiliate_code)) = ANY($1::text[])
                    OR NULLIF(affiliate_user_id, '') = ANY($2::text[])
                 RETURNING id`,
                [
                    referCodes.map((c) => c.toLowerCase()),
                    [...adminIds, ...seIds],
                ]
            )
        ).rowCount;
    }

    if (adminIds.length > 0) {
        deleted.admin_payments = (
            await client.query(
                `DELETE FROM admin_payments WHERE recipient_id::text = ANY($1::text[]) RETURNING id`,
                [adminIds]
            )
        ).rowCount;
    }

    if (seIds.length > 0 || seReferCodes.length > 0) {
        deleted.withdrawal_request = (
            await client.query(
                `DELETE FROM withdrawal_request
                 WHERE affiliate_id::text = ANY($1::text[])
                    OR LOWER(TRIM(affiliate_code)) = ANY($2::text[])
                 RETURNING id`,
                [seIds, seReferCodes.map((c) => c.toLowerCase())]
            )
        ).rowCount;

        if (includeReferrals && seReferCodes.length > 0) {
            deleted.affiliate_referrals = (
                await client.query(
                    `DELETE FROM affiliate_referrals
                     WHERE LOWER(TRIM(affiliate_code)) = ANY($1::text[])
                     RETURNING id`,
                    [seReferCodes.map((c) => c.toLowerCase())]
                )
            ).rowCount;
        }
    }

    if (allWalletIds.length > 0) {
        deleted.customer_wallet_reset = (
            await client.query(
                `UPDATE customer_wallet SET coins_balance = 0
                 WHERE customer_id = ANY($1::text[])`,
                [allWalletIds]
            )
        ).rowCount;
    }

    return deleted;
}

async function main() {
    if (!loadDatabaseUrl()) {
        console.error("DATABASE_URL not found in .env");
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        const accounts = await resolveTestAccounts(client);
        const scope = await collectScope(client, accounts);

        console.log(`Mode: ${dryRun ? "DRY RUN" : "CLEANUP"}`);
        if (includeOrders) console.log("Also deleting Medusa order rows (--include-orders)\n");
        if (!includeReferrals) {
            console.log("affiliate_referrals preserved (pass --include-referrals to delete SE referral rows)\n");
        }

        console.log("=== Resolved test accounts ===");
        console.table(
            accounts.map((a) =>
                a.missing
                    ? { email: a.email, status: "NOT FOUND" }
                    : {
                          email: a.email,
                          role: a.portal_role,
                          table: a.table_name,
                          refer_code: a.refer_code,
                          id: a.id,
                      }
            )
        );

        console.log(`\n=== Order IDs to clear (${scope.orderIds.length}) ===`);
        if (scope.orderIds.length === 0) {
            console.log("  (none linked to test accounts)");
        } else {
            for (const id of scope.orderIds) console.log(`  ${id}`);
        }

        if (scope.commissionByOrder.rows.length) {
            console.log("\n=== Commission rows on those orders (all hierarchy) ===");
            console.table(scope.commissionByOrder.rows);
        }

        if (scope.orphanCommissions.rows.length) {
            console.log("\n=== Orphan commission rows (same accounts) ===");
            console.table(scope.orphanCommissions.rows);
        }

        if (scope.returns.rows.length) {
            console.log("\n=== Return requests ===");
            console.table(scope.returns.rows);
        }

        if (scope.adminPayments.rows.length) {
            console.log("\n=== Admin payments (test admins only) ===");
            console.table(scope.adminPayments.rows);
        }

        if (scope.wallets.rows.length) {
            console.log("\n=== Wallets to reset ===");
            console.table(scope.wallets.rows);
        }

        if (scope.withdrawals.rows.length) {
            console.log("\n=== SE withdrawal requests ===");
            console.table(scope.withdrawals.rows);
        }

        if (scope.referrals.rows.length) {
            console.log("\n=== SE referrals ===");
            console.table(scope.referrals.rows);
        }

        const nothing =
            scope.orderIds.length === 0 &&
            scope.orphanCommissions.rows.length === 0 &&
            scope.adminPayments.rows.length === 0 &&
            scope.withdrawals.rows.length === 0 &&
            scope.referrals.rows.length === 0 &&
            scope.wallets.rows.every((w) => Number.parseFloat(w.coins_balance || 0) === 0);

        if (nothing) {
            console.log("\nNothing to clear — test accounts already at zero.");
            return;
        }

        if (dryRun) {
            console.log("\nDry run only. Re-run with --confirm to execute cleanup.");
            console.log(
                "Then: node scripts/capture_commission_baseline.js --label phase1-clean --output scripts/baseline-phase1-latest.json"
            );
            return;
        }

        await client.query("BEGIN");
        const deleted = await executeCleanup(client, scope);
        await client.query("COMMIT");

        console.log("\n=== Cleanup complete ===");
        console.table(Object.entries(deleted).map(([k, v]) => ({ action: k, count: v })));
        console.log("\nRefresh Order Layout + Earnings for each test account.");
        console.log(
            "Capture baseline: node scripts/capture_commission_baseline.js --label phase1-clean --output scripts/baseline-phase1-latest.json"
        );
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
