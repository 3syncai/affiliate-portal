/* eslint-disable no-console */
/**
 * Cascade-delete a state admin and every linked account in the hierarchy.
 *
 * DB tables (authoritative):
 *   state_admin → area_sales_manager → branch_admin → affiliate_user
 *
 * UI/route naming (client relabel — do not confuse with table names):
 *   /asm  login & pages → area_sales_manager  (UI label: Branch Manager / "BM")
 *   /branch login & pages → branch_admin      (UI label: ASM)
 *
 * Usage:
 *   node scripts/delete_state_admin.js someone@gmail.com          # dry run
 *   node scripts/delete_state_admin.js someone@gmail.com --confirm
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

const dotEnv = readDotEnv();
const pool = new Pool({
    connectionString: dotEnv.DATABASE_URL || dotEnv.NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const TARGET_EMAIL =
    process.argv.find((a) => a.includes("@")) || "xyz@gmail.com";
const dryRun = !process.argv.includes("--confirm");

async function collectDeletionTree(client, stateAdminId) {
    const stateAdmin = (
        await client.query(
            `SELECT id, first_name, last_name, email, refer_code, state
             FROM state_admin WHERE id = $1`,
            [stateAdminId]
        )
    ).rows[0];

    const asms = (
        await client.query(
            `SELECT id, first_name, last_name, email, refer_code
             FROM area_sales_manager WHERE created_by = $1`,
            [stateAdminId]
        )
    ).rows;

    const asmIds = asms.map((a) => a.id);
    let branchAdmins = [];
    if (asmIds.length > 0) {
        branchAdmins = (
            await client.query(
                `SELECT id, first_name, last_name, email, refer_code, branch, created_by
                 FROM branch_admin WHERE created_by = ANY($1::uuid[])`,
                [asmIds]
            )
        ).rows;
    }

    let affiliates = [];
    for (const bm of branchAdmins) {
        const rows = (
            await client.query(
                `SELECT id, first_name, last_name, email, refer_code, branch, entry_sponsor
                 FROM affiliate_user
                 WHERE branch ILIKE $1
                    OR entry_sponsor = $2`,
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

    return { stateAdmin, asms, branchAdmins, affiliates };
}

function printTree(tree) {
    const { stateAdmin, asms, branchAdmins, affiliates } = tree;
    console.log("\n=== Deletion tree (DB table names) ===");
    console.log(
        `State admin: ${stateAdmin.first_name} ${stateAdmin.last_name} (${stateAdmin.email}) [${stateAdmin.refer_code}]`
    );

    if (asms.length === 0) {
        console.log("  └── (no area_sales_manager — UI: BM at /asm)");
    }
    for (const asm of asms) {
        console.log(
            `  └── area_sales_manager (UI BM /asm): ${asm.first_name} ${asm.last_name} (${asm.email}) [${asm.refer_code}]`
        );
        const bmForAsm = branchAdmins.filter((b) => b.created_by === asm.id);
        if (bmForAsm.length === 0) {
            console.log("        └── (no branch_admin — UI ASM at /branch)");
        }
        for (const bm of bmForAsm) {
            console.log(
                `        └── branch_admin (UI ASM /branch): ${bm.first_name} ${bm.last_name} (${bm.email}) [${bm.refer_code}] branch=${bm.branch}`
            );
            const agents = affiliates.filter(
                (a) =>
                    (a.branch && bm.branch && a.branch.toLowerCase() === bm.branch.toLowerCase()) ||
                    a.entry_sponsor === bm.refer_code
            );
            if (agents.length === 0) {
                console.log("              └── (no sales executives)");
            }
            for (const agent of agents) {
                console.log(
                    `              └── Sales exec: ${agent.first_name} ${agent.last_name} (${agent.email}) [${agent.refer_code}]`
                );
            }
        }
    }

    console.log("\n=== Summary ===");
    console.log(`  ASMs:              ${asms.length}`);
    console.log(`  Branch admins:     ${branchAdmins.length}`);
    console.log(`  Sales executives:  ${affiliates.length}`);
}

async function executeCascadeDelete(client, tree) {
    const { stateAdmin, asms, branchAdmins, affiliates } = tree;

    const affiliateIds = affiliates.map((a) => a.id);
    const affiliateCodes = affiliates.map((a) => a.refer_code);
    const bmIds = branchAdmins.map((b) => b.id);
    const bmCodes = branchAdmins.map((b) => b.refer_code);
    const asmIds = asms.map((a) => a.id);
    const asmCodes = asms.map((a) => a.refer_code);
    const allReferCodes = [
        stateAdmin.refer_code,
        ...asmCodes,
        ...bmCodes,
        ...affiliateCodes,
    ].filter(Boolean);
    const allEntityIds = [
        stateAdmin.id,
        ...asmIds,
        ...bmIds,
        ...affiliateIds,
    ];

    const deleted = {};

    if (affiliateIds.length > 0) {
        const r = await client.query(
            "DELETE FROM withdrawal_request WHERE affiliate_id = ANY($1::text[]) RETURNING id",
            [affiliateIds]
        );
        deleted.withdrawal_request = r.rowCount;
        const w = await client.query(
            "DELETE FROM customer_wallet WHERE customer_id = ANY($1::text[]) RETURNING customer_id",
            [affiliateIds]
        );
        deleted.customer_wallet = w.rowCount;
    }

    if (allReferCodes.length > 0) {
        const c = await client.query(
            "DELETE FROM affiliate_commission_log WHERE affiliate_code = ANY($1::text[]) RETURNING id",
            [allReferCodes]
        );
        deleted.commission_by_code = c.rowCount;
    }

    if (allEntityIds.length > 0) {
        const idStrings = allEntityIds.map(String);
        const c2 = await client.query(
            "DELETE FROM affiliate_commission_log WHERE affiliate_user_id = ANY($1::text[]) RETURNING id",
            [idStrings]
        );
        deleted.commission_by_user_id = c2.rowCount;

        const r = await client.query(
            "DELETE FROM affiliate_referrals WHERE affiliate_code = ANY($1::text[]) RETURNING id",
            [allReferCodes]
        );
        deleted.affiliate_referrals = r.rowCount;

        const adminIds = [stateAdmin.id, ...asmIds, ...bmIds];
        const p2 = await client.query(
            `DELETE FROM admin_payments WHERE recipient_id = ANY($1::uuid[]) RETURNING id`,
            [adminIds]
        );
        deleted.admin_payments = p2.rowCount;

        await client.query(
            `DELETE FROM notifications
             WHERE (recipient_id = ANY($1::text[]) AND recipient_role IN ('state', 'asm', 'branch'))
                OR (sender_id = ANY($1::text[]))`,
            [idStrings]
        );

        await client.query(
            "DELETE FROM activity_log WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])",
            [idStrings]
        );
    }

    // branch_admin_referrals may not exist in all environments
    if (bmIds.length > 0) {
        try {
            const bar = await client.query(
                "DELETE FROM branch_admin_referrals WHERE branch_admin_id = ANY($1::uuid[]) RETURNING id",
                [bmIds]
            );
            deleted.branch_admin_referrals = bar.rowCount;
        } catch {
            /* table optional */
        }
    }

    if (allReferCodes.length > 0) {
        await client.query(
            `UPDATE customer
             SET metadata = metadata - 'referral_code'
             WHERE metadata->>'referral_code' = ANY($1::text[])`,
            [allReferCodes]
        );
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

    if (asmIds.length > 0) {
        const a = await client.query(
            "DELETE FROM area_sales_manager WHERE id = ANY($1::uuid[]) RETURNING email, refer_code",
            [asmIds]
        );
        deleted.area_sales_manager = a.rowCount;
        if (a.rows.length) console.table(a.rows);
    }

    const sa = await client.query(
        "DELETE FROM state_admin WHERE id = $1 RETURNING email, refer_code",
        [stateAdmin.id]
    );
    deleted.state_admin = sa.rowCount;
    console.log("\nDeleted state admin:");
    console.table(sa.rows);

    console.log("\nRelated rows removed:");
    console.table(
        Object.entries(deleted).map(([table, count]) => ({ table, count }))
    );
}

async function main() {
    const sa = await pool.query(
        `SELECT id, first_name, last_name, email, refer_code, state
         FROM state_admin WHERE email = $1`,
        [TARGET_EMAIL]
    );

    if (sa.rows.length === 0) {
        console.log(`No state_admin found for ${TARGET_EMAIL}. Nothing to delete.`);
        return;
    }

    const client = await pool.connect();
    try {
        const tree = await collectDeletionTree(client, sa.rows[0].id);
        console.log("Target state admin:");
        console.table([tree.stateAdmin]);
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
