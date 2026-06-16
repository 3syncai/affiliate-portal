import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL } from "@/lib/dashboard-return-sql";
import { getBmTerritoryGross } from "@/lib/territory-gross-commission";
import { normalizeStateParam } from "@/lib/territory-params";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

const toCount = (value: string | number | null | undefined) =>
  Number.parseInt(String(value ?? 0), 10) || 0;

async function countAsmsInTerritory(city: string, state: string): Promise<number> {
  const viaStores = await pool.query(
    `SELECT COUNT(DISTINCT ba.id)::int AS count
     FROM branch_admin ba
     JOIN stores s ON ba.branch ILIKE s.branch_name
     WHERE s.city ILIKE $1 AND s.state ILIKE $2
       AND COALESCE(ba.is_active, true) = true`,
    [city, state],
  );
  const storeCount = toCount(viaStores.rows[0]?.count);
  if (storeCount > 0) return storeCount;

  const direct = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM branch_admin ba
     WHERE ba.city ILIKE $1 AND ba.state ILIKE $2
       AND COALESCE(ba.is_active, true) = true`,
    [city, state],
  );
  return toCount(direct.rows[0]?.count);
}

/** Branch Manager dashboard (`/asm` route) — area = city + state. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const rawState = searchParams.get("state");
  const adminId = searchParams.get("adminId");

  if (!city || !rawState) {
    return NextResponse.json(
      { success: false, error: "City and state are required" },
      { status: 400 },
    );
  }

  const state = normalizeStateParam(rawState);

  try {
    let commissionRates = {
      summary: {
        asm: { directRate: 0, overrideRate: 0 },
      },
    };
    try {
      commissionRates = await fetchCommissionRates(pool);
    } catch (err) {
      console.warn("[ASM Dashboard Stats] commission rates failed:", err);
    }

    let commissionRate = commissionRates.summary.asm.overrideRate;
    let bmReferCode = "";

    if (adminId) {
      try {
        const asmRow = await pool.query(
          `SELECT asm.refer_code, cr.commission_percentage
           FROM area_sales_manager asm
           LEFT JOIN commission_rates cr ON cr.role_type = 'area'
           WHERE asm.id = $1`,
          [adminId],
        );
        if (asmRow.rows[0]) {
          bmReferCode = asmRow.rows[0].refer_code || "";
          commissionRate = toAmount(
            asmRow.rows[0].commission_percentage ?? commissionRate,
          );
        }
      } catch (err) {
        console.warn("[ASM Dashboard Stats] BM lookup failed:", err);
      }
    }

    const totalASMs = await countAsmsInTerritory(city, state);

    const agentsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM affiliate_user u
       JOIN stores s ON u.branch ILIKE s.branch_name
       WHERE s.city ILIKE $1 AND s.state ILIKE $2 AND u.is_agent = true`,
      [city, state],
    );

    let totalOrders = 0;
    let totalReturns = 0;
    let totalCommission = 0;
    let creditedCommission = 0;
    let pendingCommission = 0;

    try {
      await syncAffiliateCommissionStatuses(pool, {
        logPrefix: "[ASM Dashboard Stats]",
      });
    } catch (err) {
      console.warn("[ASM Dashboard Stats] status sync failed:", err);
    }

    try {
      const territoryResult = await pool.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COUNT(DISTINCT acl.order_id) FILTER (
             WHERE ${COMMISSION_IS_RETURN_OR_CANCELLED_SQL}
           )::int AS total_returns
         FROM affiliate_commission_log acl
         JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
         JOIN stores s ON u.branch ILIKE s.branch_name
         WHERE s.city ILIKE $1 AND s.state ILIKE $2`,
        [city, state],
      );
      totalOrders = toCount(territoryResult.rows[0]?.total_orders);
      totalReturns = toCount(territoryResult.rows[0]?.total_returns);

      const territoryGross = await getBmTerritoryGross(
        pool,
        city,
        state,
        bmReferCode || undefined,
      );
      totalCommission = territoryGross.total;
      creditedCommission = territoryGross.credited;
      pendingCommission = territoryGross.pending;
    } catch (err) {
      console.error("[ASM Dashboard Stats] order/commission stats failed:", err);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalASMs,
        salesExecutives: toCount(agentsResult.rows[0]?.count),
        totalOrders,
        totalReturns,
        totalCommission,
        credited_commission: creditedCommission,
        pending_commission: pendingCommission,
        directRate: commissionRates.summary.asm.directRate,
        overrideRate: commissionRate,
      },
    });
  } catch (error: unknown) {
    console.error("[ASM Dashboard Stats] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
