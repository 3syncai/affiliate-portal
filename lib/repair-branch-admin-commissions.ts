import type { Pool } from "pg";

type Queryable = Pick<Pool, "query">;

type BranchAdminRow = {
    id: string;
    refer_code: string;
    first_name: string;
    last_name: string;
    email: string;
};

type MissingOrderRow = {
    order_id: string;
    product_name: string;
    quantity: number | null;
    item_price: string | number | null;
    order_amount: string | number | null;
    commission_rate: string | number | null;
    commission_amount: string | number | null;
    status: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    product_id: string | null;
    category_id: string | null;
    collection_id: string | null;
    se_refer_code: string;
    se_branch: string;
    approved_by: string | null;
    entry_sponsor: string | null;
};

async function resolveBranchAdminForSale(
    db: Queryable,
    branch: string,
    approvedBy: string | null,
    entrySponsor: string | null,
): Promise<BranchAdminRow | null> {
    const result = await db.query(
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
        `,
        [branch, approvedBy, entrySponsor],
    );

    return result.rows[0] ?? null;
}

/**
 * Inserts missing branch_admin override rows for SE sales that already have
 * affiliate + upstream hierarchy rows but no ASM (/branch) commission entry.
 */
export async function repairMissingBranchAdminCommissions(
    db: Queryable,
    options: { logPrefix?: string; branchFilter?: string } = {},
): Promise<number> {
    const { logPrefix = "[Branch Admin Repair]", branchFilter } = options;

    const branchClause = branchFilter ? "AND au.branch ILIKE $1" : "";
    const params = branchFilter ? [branchFilter] : [];

    const missing = await db.query(
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

    if (missing.rows.length === 0) {
        return 0;
    }

    const rateResult = await db.query(
        `SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch' LIMIT 1`,
    );
    const branchRate =
        Number.parseFloat(String(rateResult.rows[0]?.commission_percentage ?? 0)) || 0;

    let inserted = 0;

    for (const row of missing.rows as MissingOrderRow[]) {
        const branchAdmin = await resolveBranchAdminForSale(
            db,
            row.se_branch,
            row.approved_by,
            row.entry_sponsor,
        );

        if (!branchAdmin) {
            console.warn(
                `${logPrefix} no branch_admin for branch "${row.se_branch}" (order ${row.order_id})`,
            );
            continue;
        }

        const commissionAmount =
            Number.parseFloat(String(row.commission_amount ?? 0)) || 0;
        const branchCommission = commissionAmount * (branchRate / 100);

        await db.query(
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
            `${logPrefix} inserted branch_admin override ₹${branchCommission.toFixed(2)} for order ${row.order_id} -> ${branchAdmin.first_name} ${branchAdmin.last_name}`,
        );
    }

    return inserted;
}

export { resolveBranchAdminForSale };
