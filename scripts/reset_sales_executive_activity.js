/* eslint-disable no-console */
/**
 * Reset a sales executive's activity (orders, commissions, wallet, referrals)
 * while keeping the affiliate_user account for re-testing.
 *
 * Usage:
 *   node scripts/reset_sales_executive_activity.js OWEGABHIJIT45555
 *   node scripts/reset_sales_executive_activity.js OWEGABHIJIT45555 --confirm
 *   node scripts/reset_sales_executive_activity.js user@email.com --confirm
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

const args = process.argv.slice(2).filter((a) => a !== "--confirm");
const TARGET = args[0] || "";
const dryRun = !process.argv.includes("--confirm");

const pool = new Pool({
    connectionString: readDotEnv().DATABASE_URL || readDotEnv().NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function resolveUser(client, target) {
    const byCode = await client.query(
        `SELECT id, first_name, last_name, email, refer_code
         FROM affiliate_user
         WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1))`,
        [target]
    );
    if (byCode.rows.length > 0) return byCode.rows[0];

    const byEmail = await client.query(
        `SELECT id, first_name, last_name, email, refer_code
         FROM affiliate_user
         WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
        [target]
    );
    return byEmail.rows[0] || null;
}

async function collectPreview(client, user) {
    const referCode = user.refer_code;

    const ordersResult = await client.query(
        `SELECT DISTINCT order_id
         FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND commission_source = 'affiliate'`,
        [referCode]
    );
    const orderIds = ordersResult.rows.map((r) => r.order_id).filter(Boolean);

    let commissionByOrder = { rowCount: 0, rows: [] };
    if (orderIds.length > 0) {
        commissionByOrder = await client.query(
            `SELECT id, order_id, affiliate_code, commission_source, commission_amount, affiliate_commission, status
             FROM affiliate_commission_log
             WHERE order_id = ANY($1::text[])
             ORDER BY order_id, commission_source`,
            [orderIds]
        );
    }

    const commissionByCode = await client.query(
        `SELECT id, order_id, commission_source, commission_amount, affiliate_commission, status
         FROM affiliate_commission_log
         WHERE affiliate_code = $1`,
        [referCode]
    );

    const referrals = await client.query(
        `SELECT id, customer_id, customer_email, referred_at
         FROM affiliate_referrals
         WHERE affiliate_code = $1`,
        [referCode]
    );

    const wallet = await client.query(
        `SELECT customer_id, coins_balance
         FROM customer_wallet
         WHERE customer_id = $1`,
        [user.id]
    );

    const withdrawals = await client.query(
        `SELECT id, withdrawal_amount, status
         FROM withdrawal_request
         WHERE affiliate_id = $1 OR affiliate_code = $2`,
        [String(user.id), referCode]
    );

    let returns = { rows: [] };
    if (orderIds.length > 0) {
        try {
            returns = await client.query(
                `SELECT id, order_id, status
                 FROM return_request
                 WHERE order_id = ANY($1::text[])`,
                [orderIds]
            );
        } catch {
            /* optional table */
        }
    }

    const totalSeCommission = commissionByCode.rows.reduce(
        (sum, row) => sum + Number.parseFloat(row.affiliate_commission || 0),
        0
    );

    return {
        referCode,
        orderIds,
        commissionByOrder,
        commissionByCode,
        referrals,
        wallet,
        withdrawals,
        returns,
        totalSeCommission,
    };
}

async function executeReset(client, user, preview) {
    const { referCode, orderIds } = preview;
    const deleted = {};

    if (orderIds.length > 0) {
        try {
            deleted.return_request = (
                await client.query(
                    "DELETE FROM return_request WHERE order_id = ANY($1::text[])",
                    [orderIds]
                )
            ).rowCount;
        } catch {
            deleted.return_request = 0;
        }

        deleted.commission_by_order = (
            await client.query(
                "DELETE FROM affiliate_commission_log WHERE order_id = ANY($1::text[])",
                [orderIds]
            )
        ).rowCount;
    }

    deleted.commission_by_code = (
        await client.query(
            "DELETE FROM affiliate_commission_log WHERE affiliate_code = $1",
            [referCode]
        )
    ).rowCount;

    deleted.withdrawal_request = (
        await client.query(
            "DELETE FROM withdrawal_request WHERE affiliate_id = $1 OR affiliate_code = $2",
            [String(user.id), referCode]
        )
    ).rowCount;

    const walletUpdate = await client.query(
        `UPDATE customer_wallet SET coins_balance = 0 WHERE customer_id = $1 RETURNING customer_id`,
        [user.id]
    );
    deleted.customer_wallet_reset = walletUpdate.rowCount;

    deleted.affiliate_referrals = (
        await client.query(
            "DELETE FROM affiliate_referrals WHERE affiliate_code = $1",
            [referCode]
        )
    ).rowCount;

    return deleted;
}

async function main() {
    if (!TARGET) {
        console.error(
            "Usage: node scripts/reset_sales_executive_activity.js <refer_code|email> [--confirm]"
        );
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        const user = await resolveUser(client, TARGET);
        if (!user) {
            console.error(`No affiliate_user found for: ${TARGET}`);
            process.exit(1);
        }

        const preview = await collectPreview(client, user);

        console.log("Target sales executive:");
        console.table([user]);
        console.log(`Mode: ${dryRun ? "DRY RUN" : "RESET"}\n`);

        console.log("=== Preview ===");
        console.log(`SE orders (affiliate source): ${preview.orderIds.length}`);
        if (preview.orderIds.length) console.log(preview.orderIds.join(", "));
        console.log(`Commission rows (all sources for those orders): ${preview.commissionByOrder.rows.length}`);
        console.log(`Commission rows (affiliate_code = SE): ${preview.commissionByCode.rows.length}`);
        console.log(`SE personal commission total: ₹${preview.totalSeCommission.toFixed(2)}`);
        console.log(`Referrals: ${preview.referrals.rows.length}`);
        console.log(
            `Wallet balance: ₹${Number.parseFloat(preview.wallet.rows[0]?.coins_balance || 0).toFixed(2)}`
        );
        console.log(`Withdrawal requests: ${preview.withdrawals.rows.length}`);
        console.log(`Return requests: ${preview.returns.rows.length}`);

        if (preview.commissionByOrder.rows.length) {
            console.log("\nCommission log (by order):");
            console.table(preview.commissionByOrder.rows);
        }

        const nothingToReset =
            preview.orderIds.length === 0 &&
            preview.commissionByCode.rows.length === 0 &&
            preview.referrals.rows.length === 0 &&
            Number.parseFloat(preview.wallet.rows[0]?.coins_balance || 0) === 0 &&
            preview.withdrawals.rows.length === 0;

        if (nothingToReset) {
            console.log("\nNothing to reset — dashboard should already be clear.");
            return;
        }

        if (dryRun) {
            console.log("\nDry run only. Re-run with --confirm to reset.");
            return;
        }

        await client.query("BEGIN");
        const deleted = await executeReset(client, user, preview);
        await client.query("COMMIT");

        console.log("\nReset complete:");
        console.table(Object.entries(deleted).map(([table, count]) => ({ table, count })));
        console.log("\nRefresh /dashboard — referrals, orders, commission, and wallet should be 0.");
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
