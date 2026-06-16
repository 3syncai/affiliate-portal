/* eslint-disable no-console */
/**
 * Delete a single branch_admin (UI: ASM at /branch) and related data.
 * Does NOT delete sales executives, other ASMs, BMs, or state admins.
 *
 * Usage:
 *   node scripts/delete_branch_admin.js vg2556519@gmail.com
 *   node scripts/delete_branch_admin.js vg2556519@gmail.com --confirm
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

const TARGET = process.argv.find((a) => a.includes("@")) || process.argv[2] || "";
const dryRun = !process.argv.includes("--confirm");

const pool = new Pool({
    connectionString: readDotEnv().DATABASE_URL || readDotEnv().NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function resolveBranchAdmin(client, target) {
    const byEmail = await client.query(
        `SELECT id, first_name, last_name, email, refer_code, branch, city, state, is_active, created_by
         FROM branch_admin WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
        [target]
    );
    if (byEmail.rows[0]) return byEmail.rows[0];

    const byCode = await client.query(
        `SELECT id, first_name, last_name, email, refer_code, branch, city, state, is_active, created_by
         FROM branch_admin WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1))`,
        [target]
    );
    return byCode.rows[0] || null;
}

async function preview(client, ba) {
    const id = ba.id;
    const idStr = String(id);
    const referCode = ba.refer_code;

    const commissionByCode = await client.query(
        `SELECT COUNT(*)::int AS c FROM affiliate_commission_log WHERE affiliate_code = $1`,
        [referCode]
    );
    const commissionByUser = await client.query(
        `SELECT COUNT(*)::int AS c FROM affiliate_commission_log WHERE affiliate_user_id = $1::text`,
        [idStr]
    );
    const linkedSe = await client.query(
        `SELECT COUNT(*)::int AS c FROM affiliate_user
         WHERE approved_by::text = $1 OR entry_sponsor = $2`,
        [idStr, referCode]
    );
    const wallet = await client.query(
        `SELECT coins_balance FROM customer_wallet WHERE customer_id = $1::text`,
        [idStr]
    );

    return {
        commissionByCode: commissionByCode.rows[0]?.c ?? 0,
        commissionByUser: commissionByUser.rows[0]?.c ?? 0,
        linkedSe: linkedSe.rows[0]?.c ?? 0,
        walletBalance: wallet.rows[0]?.coins_balance ?? 0,
    };
}

async function optionalQuery(client, label, fn) {
    const sp = `sp_${label.replace(/\W/g, "_")}`;
    await client.query(`SAVEPOINT ${sp}`);
    try {
        return await fn();
    } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        return 0;
    } finally {
        await client.query(`RELEASE SAVEPOINT ${sp}`);
    }
}

async function executeDelete(client, ba) {
    const id = ba.id;
    const idStr = String(id);
    const referCode = ba.refer_code;
    const deleted = {};

    deleted.commission_by_code = (
        await client.query(
            "DELETE FROM affiliate_commission_log WHERE affiliate_code = $1 RETURNING id",
            [referCode]
        )
    ).rowCount;

    deleted.commission_by_user_id = (
        await client.query(
            "DELETE FROM affiliate_commission_log WHERE affiliate_user_id = $1::text RETURNING id",
            [idStr]
        )
    ).rowCount;

    deleted.admin_payments = (
        await client.query(
            "DELETE FROM admin_payments WHERE recipient_id = $1 RETURNING id",
            [id]
        )
    ).rowCount;

    deleted.branch_admin_referrals = await optionalQuery(client, "branch_admin_referrals", async () =>
        (
            await client.query(
                "DELETE FROM branch_admin_referrals WHERE branch_admin_code = $1 RETURNING id",
                [referCode]
            )
        ).rowCount
    );

    deleted.customer_wallet = (
        await client.query(
            "DELETE FROM customer_wallet WHERE customer_id = $1::text RETURNING customer_id",
            [idStr]
        )
    ).rowCount;

    await client.query(
        `DELETE FROM notifications
         WHERE (recipient_id = $1::text AND recipient_role = 'branch')
            OR sender_id = $1::text`,
        [idStr]
    );

    await client.query(
        "DELETE FROM activity_log WHERE actor_id = $1::text OR target_id = $1::text",
        [idStr]
    );

    deleted.se_references_cleared = (
        await client.query(
            `UPDATE affiliate_user
             SET approved_by = NULL
             WHERE approved_by::text = $1::text`,
            [idStr]
        )
    ).rowCount;

    const del = await client.query(
        "DELETE FROM branch_admin WHERE id = $1 RETURNING email, refer_code, branch",
        [id]
    );
    deleted.branch_admin = del.rowCount;

    return { deleted, del };
}

async function main() {
    if (!TARGET) {
        console.error("Usage: node scripts/delete_branch_admin.js <email|refer_code> [--confirm]");
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        const ba = await resolveBranchAdmin(client, TARGET);
        if (!ba) {
            console.error(`No branch_admin (ASM) found for: ${TARGET}`);
            process.exit(1);
        }

        console.log("Target ASM (branch_admin / /branch):");
        console.table([ba]);

        const stats = await preview(client, ba);
        console.log("\nRelated data (ASM only — sales executives are kept):");
        console.table([stats]);

        if (dryRun) {
            console.log("\nDry run only. Re-run with --confirm to delete this ASM.");
            return;
        }

        await client.query("BEGIN");
        const { deleted, del } = await executeDelete(client, ba);
        await client.query("COMMIT");

        console.log("\nDeleted branch_admin:");
        console.table(del.rows);
        console.log("\nRelated rows removed:");
        console.table(Object.entries(deleted).map(([table, count]) => ({ table, count })));
        console.log("\nSales executives under this branch were NOT deleted (approved_by cleared where set).");
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
