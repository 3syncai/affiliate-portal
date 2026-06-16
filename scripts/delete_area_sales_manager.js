/* eslint-disable no-console */
/**
 * Cascade-delete an area_sales_manager (UI: Branch Admin / BM at /asm)
 * and all linked branch_admin + affiliate_user accounts.
 *
 * DB: area_sales_manager → branch_admin → affiliate_user
 * UI: /asm (BM) → /branch (ASM) → sales executive
 *
 * Usage:
 *   node scripts/delete_area_sales_manager.js rajan@gmail.com
 *   node scripts/delete_area_sales_manager.js rajan@gmail.com --confirm
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

const pool = new Pool({
    connectionString: readDotEnv().DATABASE_URL || readDotEnv().NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const TARGET_EMAIL = process.argv.find((a) => a.includes("@")) || "";
const dryRun = !process.argv.includes("--confirm");

async function collectTree(client, asmId) {
    const asm = (
        await client.query(
            `SELECT id, first_name, last_name, email, refer_code, city, state
             FROM area_sales_manager WHERE id = $1`,
            [asmId]
        )
    ).rows[0];

    const branchAdmins = (
        await client.query(
            `SELECT id, first_name, last_name, email, refer_code, branch, created_by
             FROM branch_admin WHERE created_by = $1`,
            [asmId]
        )
    ).rows;

    let affiliates = [];
    for (const bm of branchAdmins) {
        const rows = (
            await client.query(
                `SELECT id, first_name, last_name, email, refer_code, branch, entry_sponsor
                 FROM affiliate_user
                 WHERE branch ILIKE $1 OR entry_sponsor = $2`,
                [bm.branch, bm.refer_code]
            )
        ).rows;
        affiliates.push(...rows);
    }

    const seen = new Set();
    affiliates = affiliates.filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
    });

    return { asm, branchAdmins, affiliates };
}

function printTree(tree) {
    const { asm, branchAdmins, affiliates } = tree;
    console.log("\n=== Deletion tree ===");
    console.log(
        `area_sales_manager (UI Branch Admin /asm): ${asm.first_name} ${asm.last_name} (${asm.email}) [${asm.refer_code}]`
    );
    if (branchAdmins.length === 0) {
        console.log("  └── (no branch_admin — UI ASM at /branch)");
    }
    for (const bm of branchAdmins) {
        console.log(
            `  └── branch_admin (UI ASM /branch): ${bm.first_name} ${bm.last_name} (${bm.email}) [${bm.refer_code}] branch=${bm.branch}`
        );
        const agents = affiliates.filter(
            (a) =>
                (a.branch && bm.branch && a.branch.toLowerCase() === bm.branch.toLowerCase()) ||
                a.entry_sponsor === bm.refer_code
        );
        if (agents.length === 0) {
            console.log("        └── (no sales executives)");
        }
        for (const agent of agents) {
            console.log(
                `        └── Sales exec: ${agent.first_name} ${agent.last_name} (${agent.email}) [${agent.refer_code}]`
            );
        }
    }
    console.log("\n=== Summary ===");
    console.log(`  branch_admin (UI ASM):  ${branchAdmins.length}`);
    console.log(`  sales executives:       ${affiliates.length}`);
}

async function executeCascadeDelete(client, tree) {
    const { asm, branchAdmins, affiliates } = tree;
    const affiliateIds = affiliates.map((a) => a.id);
    const bmIds = branchAdmins.map((b) => b.id);
    const allReferCodes = [
        asm.refer_code,
        ...branchAdmins.map((b) => b.refer_code),
        ...affiliates.map((a) => a.refer_code),
    ].filter(Boolean);
    const allEntityIds = [asm.id, ...bmIds, ...affiliateIds];
    const idStrings = allEntityIds.map(String);
    const deleted = {};

    if (affiliateIds.length > 0) {
        deleted.withdrawal_request = (
            await client.query(
                "DELETE FROM withdrawal_request WHERE affiliate_id = ANY($1::text[])",
                [affiliateIds]
            )
        ).rowCount;
        deleted.customer_wallet = (
            await client.query(
                "DELETE FROM customer_wallet WHERE customer_id = ANY($1::text[])",
                [affiliateIds]
            )
        ).rowCount;
    }

    if (allReferCodes.length > 0) {
        deleted.commission_by_code = (
            await client.query(
                "DELETE FROM affiliate_commission_log WHERE affiliate_code = ANY($1::text[])",
                [allReferCodes]
            )
        ).rowCount;
        deleted.affiliate_referrals = (
            await client.query(
                "DELETE FROM affiliate_referrals WHERE affiliate_code = ANY($1::text[])",
                [allReferCodes]
            )
        ).rowCount;
        await client.query(
            `UPDATE customer SET metadata = metadata - 'referral_code'
             WHERE metadata->>'referral_code' = ANY($1::text[])`,
            [allReferCodes]
        );
    }

    if (idStrings.length > 0) {
        deleted.commission_by_user_id = (
            await client.query(
                "DELETE FROM affiliate_commission_log WHERE affiliate_user_id = ANY($1::text[])",
                [idStrings]
            )
        ).rowCount;
        deleted.admin_payments = (
            await client.query(
                "DELETE FROM admin_payments WHERE recipient_id = ANY($1::uuid[])",
                [allEntityIds]
            )
        ).rowCount;
        await client.query(
            `DELETE FROM notifications
             WHERE (recipient_id = ANY($1::text[]) AND recipient_role IN ('asm', 'branch'))
                OR sender_id = ANY($1::text[])`,
            [idStrings]
        );
        await client.query(
            "DELETE FROM activity_log WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])",
            [idStrings]
        );
    }

    if (bmIds.length > 0) {
        try {
            deleted.branch_admin_referrals = (
                await client.query(
                    "DELETE FROM branch_admin_referrals WHERE branch_admin_id = ANY($1::uuid[])",
                    [bmIds]
                )
            ).rowCount;
        } catch {
            /* optional table */
        }
    }

    if (affiliateIds.length > 0) {
        const a = await client.query(
            "DELETE FROM affiliate_user WHERE id = ANY($1::uuid[]) RETURNING email, refer_code",
            [affiliateIds]
        );
        deleted.affiliate_user = a.rowCount;
        if (a.rows.length) console.table(a.rows);
    }

    if (bmIds.length > 0) {
        const b = await client.query(
            "DELETE FROM branch_admin WHERE id = ANY($1::uuid[]) RETURNING email, refer_code",
            [bmIds]
        );
        deleted.branch_admin = b.rowCount;
        if (b.rows.length) console.table(b.rows);
    }

    const del = await client.query(
        "DELETE FROM area_sales_manager WHERE id = $1 RETURNING email, refer_code",
        [asm.id]
    );
    deleted.area_sales_manager = del.rowCount;
    console.log("\nDeleted area_sales_manager (UI Branch Admin):");
    console.table(del.rows);

    console.log("\nRelated rows removed:");
    console.table(Object.entries(deleted).map(([table, count]) => ({ table, count })));
}

async function main() {
    if (!TARGET_EMAIL) {
        console.error("Usage: node scripts/delete_area_sales_manager.js <email> [--confirm]");
        process.exit(1);
    }

    const found = await pool.query(
        `SELECT id, first_name, last_name, email, refer_code, city, state
         FROM area_sales_manager WHERE email = $1`,
        [TARGET_EMAIL]
    );

    if (found.rows.length === 0) {
        console.log(`No area_sales_manager found for ${TARGET_EMAIL}. Nothing to delete.`);
        return;
    }

    const client = await pool.connect();
    try {
        const tree = await collectTree(client, found.rows[0].id);
        console.log("Target (UI Branch Admin /asm):");
        console.table([tree.asm]);
        console.log(`Mode: ${dryRun ? "DRY RUN" : "DELETE"}`);
        printTree(tree);

        if (dryRun) {
            console.log("\nDry run only. Re-run with --confirm to delete.");
            return;
        }

        await client.query("BEGIN");
        await executeCascadeDelete(client, tree);
        await client.query("COMMIT");
        console.log("\nCascade delete completed.");
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
