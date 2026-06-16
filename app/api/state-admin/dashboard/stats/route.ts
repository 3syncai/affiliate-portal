import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL } from "@/lib/dashboard-return-sql";
import { getStateTerritoryGross } from "@/lib/territory-gross-commission";
import { normalizeStateParam } from "@/lib/territory-params";

export const dynamic = "force-dynamic";

const toCount = (value: string | number | null | undefined) =>
  Number.parseInt(String(value ?? 0), 10) || 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawState = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!rawState) {
      return NextResponse.json(
        { success: false, error: "State parameter is required" },
        { status: 400 },
      );
    }

    const state = normalizeStateParam(rawState);

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

    let commissionRates = {
      summary: {
        state: { directRate: 0, overrideRate: 0 },
      },
    };
    try {
      commissionRates = await fetchCommissionRates(pool);
    } catch (err) {
      console.warn("[State Admin Dashboard Stats] commission rates failed:", err);
    }

    let stateReferCode = "";
    try {
      if (adminId) {
        const adminRow = await pool.query(
          `SELECT refer_code FROM state_admin WHERE id = $1`,
          [adminId],
        );
        stateReferCode = adminRow.rows[0]?.refer_code || "";
      } else {
        const adminRow = await pool.query(
          `SELECT refer_code FROM state_admin WHERE state ILIKE $1 LIMIT 1`,
          [state],
        );
        stateReferCode = adminRow.rows[0]?.refer_code || "";
      }
    } catch (err) {
      console.warn("[State Admin Dashboard Stats] refer code lookup failed:", err);
    }

    let totalOrders = 0;
    let totalReturns = 0;
    let totalCommission = 0;
    let pendingCommission = 0;
    let creditedCommission = 0;

    try {
      await syncAffiliateCommissionStatuses(pool, {
        logPrefix: "[State Admin Dashboard Stats]",
      });
    } catch (err) {
      console.warn("[State Admin Dashboard Stats] status sync failed:", err);
    }

    try {
      const ordersResult = await pool.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COUNT(DISTINCT acl.order_id) FILTER (
             WHERE ${COMMISSION_IS_RETURN_OR_CANCELLED_SQL}
           )::int AS total_returns
         FROM affiliate_commission_log acl
         JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
         JOIN stores s ON u.branch ILIKE s.branch_name
         WHERE s.state ILIKE $1
           AND acl.commission_source = 'affiliate'`,
        [state],
      );
      totalOrders = toCount(ordersResult.rows[0]?.total_orders);
      totalReturns = toCount(ordersResult.rows[0]?.total_returns);

      const territoryGross = await getStateTerritoryGross(
        pool,
        state,
        stateReferCode || undefined,
      );
      totalCommission = territoryGross.total;
      pendingCommission = territoryGross.pending;
      creditedCommission = territoryGross.credited;
    } catch (err) {
      console.error("[State Admin Dashboard Stats] order/commission stats failed:", err);
    }

    const salesExecutives = toCount(agentsResult.rows[0]?.count);

    const stats = {
      activeBranches: toCount(activeBranchesResult.rows[0]?.count),
      branchHeads: toCount(branchHeadsResult.rows[0]?.count),
      totalASMs: toCount(asmsResult.rows[0]?.count),
      totalBranches: toCount(activeBranchesResult.rows[0]?.count),
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
