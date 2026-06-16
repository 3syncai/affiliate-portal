/**
 * Backfill affiliate_user_id on branch_admin override rows where missing.
 * Dry-run by default; pass --confirm to apply updates.
 *
 * Usage:
 *   node scripts/backfill_branch_admin_commission_user_id.js
 *   node scripts/backfill_branch_admin_commission_user_id.js --confirm
 */

const { Pool } = require("pg");

const dryRun = !process.argv.includes("--confirm");

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const preview = await pool.query(`
            SELECT acl.id, acl.order_id, acl.affiliate_commission, ba.id AS branch_admin_id, ba.first_name, ba.last_name
            FROM affiliate_commission_log acl
            JOIN branch_admin ba ON ba.branch = (
                SELECT u.branch
                FROM affiliate_commission_log se
                JOIN affiliate_user u ON u.refer_code = se.affiliate_code
                WHERE se.order_id = acl.order_id
                  AND se.commission_source = 'affiliate'
                LIMIT 1
            )
            WHERE acl.commission_source = 'branch_admin'
              AND acl.affiliate_code = 'BRANCH'
              AND (acl.affiliate_user_id IS NULL OR TRIM(acl.affiliate_user_id) = '')
        `);

        console.log(`Found ${preview.rows.length} branch_admin override row(s) missing affiliate_user_id`);
        preview.rows.forEach((row) => {
            console.log(
                `  log ${row.id} order ${row.order_id} -> ${row.first_name} ${row.last_name} (${row.branch_admin_id}) ₹${row.affiliate_commission}`,
            );
        });

        if (dryRun) {
            console.log("\nDry-run only. Re-run with --confirm to apply.");
            return;
        }

        if (preview.rows.length === 0) {
            console.log("Nothing to update.");
            return;
        }

        const result = await pool.query(`
            UPDATE affiliate_commission_log acl
            SET affiliate_user_id = ba.id::text
            FROM branch_admin ba
            WHERE acl.commission_source = 'branch_admin'
              AND acl.affiliate_code = 'BRANCH'
              AND (acl.affiliate_user_id IS NULL OR TRIM(acl.affiliate_user_id) = '')
              AND ba.branch = (
                SELECT u.branch
                FROM affiliate_commission_log se
                JOIN affiliate_user u ON u.refer_code = se.affiliate_code
                WHERE se.order_id = acl.order_id
                  AND se.commission_source = 'affiliate'
                LIMIT 1
              )
        `);

        console.log(`Updated ${result.rowCount} row(s).`);
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
