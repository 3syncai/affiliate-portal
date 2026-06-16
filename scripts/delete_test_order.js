/* eslint-disable no-console */
/**
 * Remove test order data (commission log + return request) by order_id.
 *
 * Usage:
 *   node scripts/delete_test_order.js order_01KTPVQ36D2RHZGHNJR5WKTS5X
 *   node scripts/delete_test_order.js order_01KTPVQ36D2RHZGHNJR5WKTS5X --confirm
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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

const ORDER_ID = process.argv.find((a) => a.startsWith("order_")) || "";
const dryRun = !process.argv.includes("--confirm");

const pool = new Pool({
    connectionString: readDotEnv().DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    if (!ORDER_ID) {
        console.error("Usage: node scripts/delete_test_order.js <order_id> [--confirm]");
        process.exit(1);
    }

    const commissions = await pool.query(
        `SELECT id, affiliate_code, commission_source, affiliate_user_id, affiliate_commission,
                status, commission_amount, product_name
         FROM affiliate_commission_log WHERE order_id = $1`,
        [ORDER_ID]
    );
    let returns = { rows: [] };
    try {
        returns = await pool.query(
            "SELECT id, status FROM return_request WHERE order_id = $1",
            [ORDER_ID]
        );
    } catch {
        /* return_request may not exist */
    }

    console.log(`Order: ${ORDER_ID}`);
    console.log(`Mode: ${dryRun ? "DRY RUN" : "DELETE"}\n`);

    if (commissions.rows.length) {
        console.log("Commission log rows:");
        console.table(commissions.rows);
    } else {
        console.log("No commission log rows for this order.");
    }

    if (returns.rows.length) {
        console.log("Return request rows:");
        console.table(returns.rows);
    } else {
        console.log("No return_request rows for this order.");
    }

    if (commissions.rows.length === 0 && returns.rows.length === 0) {
        console.log("\nNothing to delete.");
        return;
    }

    if (dryRun) {
        console.log("\nDry run only. Re-run with --confirm to delete.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const rowsToDelete = await client.query(
            `SELECT id, affiliate_code, commission_source, affiliate_user_id, affiliate_commission, status
             FROM affiliate_commission_log WHERE order_id = $1`,
            [ORDER_ID]
        );

        let walletAdjustments = 0;
        for (const row of rowsToDelete.rows) {
            if (row.status !== "CREDITED") continue;
            const amount = Number.parseFloat(String(row.affiliate_commission ?? 0)) || 0;
            if (amount <= 0) continue;

            let customerId = String(row.affiliate_user_id ?? "").trim();
            if (!customerId && row.commission_source === "affiliate") {
                const userRow = await client.query(
                    "SELECT id::text AS id FROM affiliate_user WHERE refer_code = $1 LIMIT 1",
                    [row.affiliate_code]
                );
                customerId = userRow.rows[0]?.id ?? "";
            }
            if (!customerId) continue;

            await client.query(
                `UPDATE customer_wallet
                 SET coins_balance = GREATEST(0, coins_balance - $2)
                 WHERE customer_id = $1::text`,
                [customerId, amount]
            );
            walletAdjustments += 1;
        }

        const delComm = await client.query(
            "DELETE FROM affiliate_commission_log WHERE order_id = $1 RETURNING id, affiliate_code",
            [ORDER_ID]
        );
        let delReturn = { rowCount: 0 };
        try {
            delReturn = await client.query(
                "DELETE FROM return_request WHERE order_id = $1 RETURNING id",
                [ORDER_ID]
            );
        } catch {
            /* optional */
        }

        await client.query("COMMIT");

        console.log(`\nDeleted ${delComm.rowCount} commission log row(s):`);
        if (delComm.rows.length) console.table(delComm.rows);
        console.log(`Reversed wallet credits for ${walletAdjustments} CREDITED row(s).`);
        console.log(`Deleted ${delReturn.rowCount} return_request row(s).`);
        console.log("\nDashboard order/return counts and recent activity should clear after refresh.");
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
