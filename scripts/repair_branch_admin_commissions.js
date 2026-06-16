/**
 * Backfill missing branch_admin (ASM /branch) commission rows for SE orders.
 *
 * Usage:
 *   node scripts/repair_branch_admin_commissions.js
 *   node scripts/repair_branch_admin_commissions.js "Agra City"
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

const branchFilter = process.argv[2] || undefined;

async function resolveBranchAdminForSale(client, branch, approvedBy, entrySponsor) {
    const result = await client.query(
        `
        SELECT id::text AS id, refer_code, first_name, last_name, email
        FROM branch_admin
        WHERE branch ILIKE $1
        ORDER BY
            CASE WHEN COALESCE(is_active, true) THEN 0 ELSE 1 END,
            CASE
                WHEN $2::text IS NOT NULL AND id::text = $2::text THEN 0
                WHEN $2::text IS NOT NULL AND refer_code = $2::text THEN 1
                WHEN $3::text IS NOT NULL AND refer_code = $3::text THEN 2
                ELSE 3
            END,
            created_at ASC
        LIMIT 1
        `,
        [branch, approvedBy, entrySponsor],
    );
    return result.rows[0] ?? null;
}

async function main() {
    const pool = new Pool({
        connectionString: readDotEnv().DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    try {
        const branchClause = branchFilter ? "AND au.branch ILIKE $1" : "";
        const params = branchFilter ? [branchFilter] : [];

        const missing = await client.query(
            `
            SELECT
                se.order_id,
                se.product_name,
                se.quantity,
                se.item_price,
                se.order_amount,
                se.commission_rate,
                se.commission_amount,
                se.status,
                se.customer_id,
                se.customer_name,
                se.customer_email,
                se.product_id,
                se.category_id,
                se.collection_id,
                se.affiliate_code AS se_refer_code,
                au.branch AS se_branch,
                au.approved_by,
                au.entry_sponsor
            FROM affiliate_commission_log se
            JOIN affiliate_user au ON au.refer_code = se.affiliate_code
            WHERE se.commission_source = 'affiliate'
              AND NULLIF(TRIM(au.branch), '') IS NOT NULL
              ${branchClause}
              AND NOT EXISTS (
                  SELECT 1
                  FROM affiliate_commission_log ba
                  WHERE ba.order_id = se.order_id
                    AND ba.commission_source = 'branch_admin'
                    AND ba.product_name IS NOT DISTINCT FROM se.product_name
              )
            ORDER BY se.created_at DESC
            `,
            params,
        );

        console.log(`Found ${missing.rows.length} order(s) missing branch_admin commission`);

        const rateResult = await client.query(
            `SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch' LIMIT 1`,
        );
        const branchRate = Number.parseFloat(String(rateResult.rows[0]?.commission_percentage ?? 0)) || 0;

        let inserted = 0;
        for (const row of missing.rows) {
            const branchAdmin = await resolveBranchAdminForSale(
                client,
                row.se_branch,
                row.approved_by,
                row.entry_sponsor,
            );
            if (!branchAdmin) {
                console.warn(`  skip ${row.order_id}: no branch_admin for "${row.se_branch}"`);
                continue;
            }

            const commissionAmount = Number.parseFloat(String(row.commission_amount ?? 0)) || 0;
            const branchCommission = commissionAmount * (branchRate / 100);

            await client.query(
                `
                INSERT INTO affiliate_commission_log (
                    order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                    commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                    commission_source, status, customer_id, customer_name, customer_email,
                    affiliate_user_id, product_id, category_id, collection_id, created_at
                ) VALUES (
                    $1, 'BRANCH', $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    'branch_admin', $10, $11, $12, $13,
                    $14, $15, $16, $17, NOW()
                )
                `,
                [
                    row.order_id,
                    row.product_name,
                    row.quantity ?? 1,
                    row.item_price ?? 0,
                    row.order_amount ?? 0,
                    row.commission_rate ?? 0,
                    commissionAmount,
                    branchRate,
                    branchCommission,
                    row.status,
                    row.customer_id,
                    `${branchAdmin.first_name} ${branchAdmin.last_name}`,
                    branchAdmin.email,
                    branchAdmin.id,
                    row.product_id,
                    row.category_id,
                    row.collection_id,
                ],
            );

            inserted += 1;
            console.log(
                `  + ${row.order_id} -> ${branchAdmin.first_name} ${branchAdmin.last_name} ₹${branchCommission.toFixed(2)} (${row.status})`,
            );
        }

        console.log(`\nInserted ${inserted} branch_admin commission row(s).`);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
