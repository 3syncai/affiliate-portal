import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");

    if (!state) {
      return NextResponse.json(
        { success: false, error: "State parameter is required" },
        { status: 400 },
      );
    }

    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[State Admin Dashboard Stats]",
    });
    const commissionRates = await fetchCommissionRates(pool);

    const activeBranchesResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM stores
       WHERE state ILIKE $1 AND COALESCE(is_active, true) = true`,
      [state],
    );

    const branchHeadsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM area_sales_manager
       WHERE state ILIKE $1 AND COALESCE(is_active, true) = true`,
      [state],
    );

    const asmsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM branch_admin
       WHERE state ILIKE $1 AND COALESCE(is_active, true) = true`,
      [state],
    );

    const agentsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM affiliate_user u
       JOIN stores s ON u.branch ILIKE s.branch_name
       WHERE s.state ILIKE $1 AND u.is_agent = true`,
      [state],
    );

    let totalOrders = 0;
    let totalReturns = 0;
    let totalCommission = 0;
    let pendingCommission = 0;
    let creditedCommission = 0;

    try {
      const ordersResult = await pool.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COUNT(*) FILTER (WHERE ${COMMISSION_HAS_RETURN_SQL})::int AS total_returns,
           COALESCE(SUM(acl.affiliate_commission), 0) AS total_commission,
           COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.affiliate_commission ELSE 0 END), 0) AS pending_commission,
           COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.affiliate_commission ELSE 0 END), 0) AS credited_commission
         FROM affiliate_commission_log acl
         JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
         JOIN stores s ON u.branch ILIKE s.branch_name
         WHERE s.state ILIKE $1`,
        [state],
      );
      totalOrders = parseInt(ordersResult.rows[0]?.total_orders || "0", 10);
      totalReturns = parseInt(ordersResult.rows[0]?.total_returns || "0", 10);
      totalCommission = parseFloat(
        ordersResult.rows[0]?.total_commission || "0",
      );
      pendingCommission = parseFloat(
        ordersResult.rows[0]?.pending_commission || "0",
      );
      creditedCommission = parseFloat(
        ordersResult.rows[0]?.credited_commission || "0",
      );
    } catch (err) {
      console.error("Failed to get state order stats:", err);
    }

    await pool.end();

    const salesExecutives = parseInt(agentsResult.rows[0]?.count || "0", 10);

    const stats = {
      activeBranches: parseInt(activeBranchesResult.rows[0]?.count || "0", 10),
      branchHeads: parseInt(branchHeadsResult.rows[0]?.count || "0", 10),
      totalASMs: parseInt(asmsResult.rows[0]?.count || "0", 10),
      totalBranches: parseInt(activeBranchesResult.rows[0]?.count || "0", 10),
      totalAgents: salesExecutives,
      salesExecutives,
      totalOrders,
      totalReturns,
      totalCommission,
      pending_commission: pendingCommission,
      credited_commission: creditedCommission,
      directRate: commissionRates.summary.state.directRate,
      overrideRate: commissionRates.summary.state.overrideRate,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error: unknown) {
    console.error("Failed to fetch state admin stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
