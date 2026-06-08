import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL } from "@/lib/dashboard-return-sql";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

const toCount = (value: string | number | null | undefined) =>
  Number.parseInt(String(value ?? 0), 10) || 0;

/** ASM dashboard (`/branch` route) — territory = branch name. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const adminId = searchParams.get("adminId");

    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch parameter is required" },
        { status: 400 },
      );
    }

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[Branch Stats]",
    });

    const commissionRates = await fetchCommissionRates(pool);

    const totalAgentsResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM affiliate_user
       WHERE branch ILIKE $1 AND is_approved = true AND is_agent = true`,
      [branch],
    );

    const pendingResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM affiliate_user
       WHERE branch ILIKE $1 AND is_approved = false AND is_agent = true`,
      [branch],
    );

    const territoryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COUNT(DISTINCT acl.order_id) FILTER (
           WHERE ${COMMISSION_IS_RETURN_OR_CANCELLED_SQL}
         )::int AS total_returns
       FROM affiliate_commission_log acl
       INNER JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
       WHERE au.branch ILIKE $1`,
      [branch],
    );

    let creditedCommission = 0;
    let pendingCommission = 0;

    if (adminId) {
      const adminRow = await pool.query(
        `SELECT refer_code FROM branch_admin WHERE id = $1`,
        [adminId],
      );
      const referCode = adminRow.rows[0]?.refer_code || "";

      const overrideResult = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited,
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending
         FROM affiliate_commission_log
         WHERE commission_source = 'branch_admin'
           AND affiliate_user_id = $1
           AND LOWER(TRIM(COALESCE(affiliate_code, ''))) <> LOWER(TRIM($2))`,
        [adminId, referCode],
      );

      const directResult = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited,
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending
         FROM affiliate_commission_log
         WHERE commission_source = 'branch_admin'
           AND LOWER(TRIM(COALESCE(affiliate_code, ''))) = LOWER(TRIM($1))`,
        [referCode],
      );

      creditedCommission =
        toAmount(overrideResult.rows[0]?.credited) +
        toAmount(directResult.rows[0]?.credited);
      pendingCommission =
        toAmount(overrideResult.rows[0]?.pending) +
        toAmount(directResult.rows[0]?.pending);
    }

    const salesExecutives = toCount(totalAgentsResult.rows[0]?.count);
    const stats = {
      totalAgents: salesExecutives,
      salesExecutives,
      pendingApproval: toCount(pendingResult.rows[0]?.count),
      totalOrders: toCount(territoryResult.rows[0]?.total_orders),
      totalReturns: toCount(territoryResult.rows[0]?.total_returns),
      totalCommission: creditedCommission + pendingCommission,
      credited_commission: creditedCommission,
      pending_commission: pendingCommission,
      directRate: commissionRates.summary.branch.directRate,
      overrideRate: commissionRates.summary.branch.overrideRate,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error: unknown) {
    console.error("Failed to fetch branch stats:", error);
    return NextResponse.json({
      success: true,
      stats: {
        totalAgents: 0,
        salesExecutives: 0,
        pendingApproval: 0,
        totalOrders: 0,
        totalReturns: 0,
        totalCommission: 0,
        credited_commission: 0,
        pending_commission: 0,
        directRate: 0,
        overrideRate: 0,
      },
    });
  }
}
