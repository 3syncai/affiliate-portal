import type { Pool } from "pg";

export type EarningsBreakdown = {
    credited: number;
    pending: number;
    creditedOrders: number;
    pendingOrders: number;
};

export type BranchAdminEarnings = {
    override: EarningsBreakdown;
    direct: EarningsBreakdown;
};

export type BmEarnings = {
    override: EarningsBreakdown;
    direct: EarningsBreakdown;
};

const toAmount = (value: string | number | null | undefined) =>
    Number.parseFloat(String(value ?? 0)) || 0;

const toCount = (value: string | number | null | undefined) =>
    Number.parseInt(String(value ?? 0), 10) || 0;

const parseBreakdown = (row: Record<string, unknown>): EarningsBreakdown => ({
    credited: toAmount(row.credited_total as string | number | null | undefined),
    pending: toAmount(row.pending_total as string | number | null | undefined),
    creditedOrders: toCount(row.credited_count as string | number | null | undefined),
    pendingOrders: toCount(row.pending_count as string | number | null | undefined),
});

/** Rows personally assigned to this ASM (used for withdrawable balance). */
export async function getBranchAdminAssignedEarnings(
    pool: Pool,
    adminId: string,
    referCode: string,
): Promise<BranchAdminEarnings> {
    const overrideResult = await pool.query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited_total,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending_total,
            COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) AS credited_count,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count
        FROM affiliate_commission_log
        WHERE commission_source = 'branch_admin'
          AND NULLIF(affiliate_user_id, '') = $1::text
          AND LOWER(TRIM(COALESCE(affiliate_code, ''))) <> LOWER(TRIM($2))
        `,
        [adminId, referCode],
    );

    const directResult = await pool.query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited_total,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending_total,
            COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) AS credited_count,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count
        FROM affiliate_commission_log
        WHERE commission_source = 'branch_admin'
          AND NULLIF(affiliate_user_id, '') = $1::text
          AND LOWER(TRIM(COALESCE(affiliate_code, ''))) = LOWER(TRIM($2))
        `,
        [adminId, referCode],
    );

    return {
        override: parseBreakdown(overrideResult.rows[0] || {}),
        direct: parseBreakdown(directResult.rows[0] || {}),
    };
}

/**
 * Team override from SE sales in this ASM's branch territory.
 * All ASMs mapped to the same branch see the same team override totals.
 */
export async function getBranchAdminTerritoryOverride(
    pool: Pool,
    branchTerritory: string,
    referCode: string,
): Promise<EarningsBreakdown> {
    if (!branchTerritory?.trim()) {
        return { credited: 0, pending: 0, creditedOrders: 0, pendingOrders: 0 };
    }

    const overrideResult = await pool.query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.affiliate_commission ELSE 0 END), 0) AS credited_total,
            COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.affiliate_commission ELSE 0 END), 0) AS pending_total,
            COUNT(CASE WHEN acl.status = 'CREDITED' THEN 1 END) AS credited_count,
            COUNT(CASE WHEN acl.status = 'PENDING' THEN 1 END) AS pending_count
        FROM affiliate_commission_log acl
        INNER JOIN affiliate_commission_log se
            ON se.order_id = acl.order_id
            AND se.commission_source = 'affiliate'
        INNER JOIN affiliate_user au ON au.refer_code = se.affiliate_code
        WHERE acl.commission_source = 'branch_admin'
          AND au.branch ILIKE $1
          AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) <> LOWER(TRIM($2))
        `,
        [branchTerritory, referCode],
    );

    return parseBreakdown(overrideResult.rows[0] || {});
}

/** Area Sales Manager (`/branch`) — display totals use territory override + personal direct. */
export async function getBranchAdminPersonalEarnings(
    pool: Pool,
    adminId: string,
    referCode: string,
    branchTerritory: string,
): Promise<BranchAdminEarnings & { assigned: BranchAdminEarnings }> {
    const assigned = await getBranchAdminAssignedEarnings(pool, adminId, referCode);
    const override = await getBranchAdminTerritoryOverride(pool, branchTerritory, referCode);

    return {
        override,
        direct: assigned.direct,
        assigned,
    };
}

/** Branch Manager (`/asm`) — sums stored affiliate_commission on area_manager + asm_direct rows. */
export async function getBmPersonalEarnings(
    pool: Pool,
    adminId: string,
    referCode: string,
): Promise<BmEarnings> {
    const overrideResult = await pool.query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited_total,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending_total,
            COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) AS credited_count,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count
        FROM affiliate_commission_log
        WHERE commission_source = 'area_manager'
          AND NULLIF(affiliate_user_id, '') = $1::text
        `,
        [adminId],
    );

    const directResult = await pool.query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited_total,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending_total,
            COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) AS credited_count,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count
        FROM affiliate_commission_log
        WHERE commission_source = 'asm_direct'
          AND (
            NULLIF(affiliate_user_id, '') = $1::text
            OR LOWER(TRIM(COALESCE(affiliate_code, ''))) = LOWER(TRIM($2))
          )
        `,
        [adminId, referCode],
    );

    return {
        override: parseBreakdown(overrideResult.rows[0] || {}),
        direct: parseBreakdown(directResult.rows[0] || {}),
    };
}

/** Resolve branch_admin id — requires adminId from client when multiple ASMs share a branch. */
export async function resolveBranchAdminId(
    pool: Pool,
    branch: string,
    preferredAdminId?: string | null,
): Promise<string | null> {
    if (preferredAdminId) {
        const byId = await pool.query(
            `SELECT id::text AS id FROM branch_admin WHERE id::text = $1::text AND branch ILIKE $2 LIMIT 1`,
            [preferredAdminId, branch],
        );
        if (byId.rows[0]?.id) {
            return byId.rows[0].id;
        }
    }

    const result = await pool.query(
        `SELECT id::text AS id FROM branch_admin WHERE branch ILIKE $1 ORDER BY created_at ASC LIMIT 1`,
        [branch],
    );
    return result.rows[0]?.id ?? null;
}
