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

/** Area Sales Manager (`/branch`) — sums stored affiliate_commission on branch_admin rows. */
export async function getBranchAdminPersonalEarnings(
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

/** Resolve branch_admin id when client only sends branch name. */
export async function resolveBranchAdminId(
    pool: Pool,
    branch: string,
): Promise<string | null> {
    const result = await pool.query(
        `SELECT id::text AS id FROM branch_admin WHERE branch ILIKE $1 LIMIT 1`,
        [branch],
    );
    return result.rows[0]?.id ?? null;
}
