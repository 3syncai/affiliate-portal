import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

const toCount = (value: string | number | null | undefined) =>
  Number.parseInt(String(value ?? 0), 10) || 0;

/** Branch Manager dashboard (`/asm` route) — area = city + state. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const adminId = searchParams.get("adminId");

  if (!city || !state) {
    return NextResponse.json(
      { success: false, error: "City and state are required" },
      { status: 400 },
    );
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[ASM Dashboard Stats]",
    });

    const commissionRates = await fetchCommissionRates(pool);
    let commissionRate = commissionRates.summary.asm.overrideRate;
    let asmReferCode = "";

    if (adminId) {
      const asmRow = await pool.query(
        `SELECT asm.refer_code, cr.commission_percentage
         FROM area_sales_manager asm
         LEFT JOIN commission_rates cr ON cr.role_type = 'area'
         WHERE asm.id = $1`,
        [adminId],
      );
      if (asmRow.rows[0]) {
        asmReferCode = asmRow.rows[0].refer_code || "";
        commissionRate = toAmount(
          asmRow.rows[0].commission_percentage ?? commissionRate,
        );
      }
    }

    const asmCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM branch_admin
       WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
         AND COALESCE(is_active, true) = true`,
      [city, state],
    );

    const agentsResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM affiliate_user u
       JOIN stores s ON u.branch ILIKE s.branch_name
       WHERE s.city ILIKE $1 AND s.state ILIKE $2 AND u.is_agent = true`,
      [city, state],
    );

    const territoryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE ${COMMISSION_HAS_RETURN_SQL})::int AS total_returns
       FROM affiliate_commission_log acl
       JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
       JOIN stores s ON u.branch ILIKE s.branch_name
       WHERE s.city ILIKE $1 AND s.state ILIKE $2`,
      [city, state],
    );

    const baseStatsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.commission_amount ELSE 0 END), 0) AS credited_base,
         COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.commission_amount ELSE 0 END), 0) AS pending_base
       FROM affiliate_commission_log acl
       JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
       JOIN stores s ON u.branch ILIKE s.branch_name
       WHERE s.city ILIKE $1 AND s.state ILIKE $2`,
      [city, state],
    );

    let creditedBranchOverride = 0;
    let pendingBranchOverride = 0;
    let creditedDirect = 0;
    let pendingDirect = 0;

    if (adminId) {
      const overrideResult = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited,
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending
         FROM affiliate_commission_log
         WHERE commission_source = 'area_manager' AND affiliate_user_id = $1`,
        [adminId],
      );
      creditedBranchOverride = toAmount(overrideResult.rows[0]?.credited);
      pendingBranchOverride = toAmount(overrideResult.rows[0]?.pending);

      if (asmReferCode) {
        const directResult = await pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) AS credited,
             COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) AS pending
           FROM affiliate_commission_log
           WHERE commission_source = 'asm_direct'
             AND (affiliate_user_id = $1 OR affiliate_code = $2)`,
          [adminId, asmReferCode],
        );
        creditedDirect = toAmount(directResult.rows[0]?.credited);
        pendingDirect = toAmount(directResult.rows[0]?.pending);
      }
    }

    const creditedLegacy =
      toAmount(baseStatsResult.rows[0]?.credited_base) *
      (commissionRate / 100);
    const pendingLegacy =
      toAmount(baseStatsResult.rows[0]?.pending_base) * (commissionRate / 100);
    const creditedCommission =
      creditedLegacy + creditedBranchOverride + creditedDirect;
    const pendingCommission =
      pendingLegacy + pendingBranchOverride + pendingDirect;

    return NextResponse.json({
      success: true,
      stats: {
        totalASMs: toCount(asmCountResult.rows[0]?.count),
        salesExecutives: toCount(agentsResult.rows[0]?.count),
        totalOrders: toCount(territoryResult.rows[0]?.total_orders),
        totalReturns: toCount(territoryResult.rows[0]?.total_returns),
        totalCommission: creditedCommission + pendingCommission,
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
  } finally {
    await pool.end();
  }
}
