import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL, COMMISSION_HAS_RETURN_SQL, COMMISSION_HAS_PENDING_RETURN_REQUEST_SQL } from "@/lib/dashboard-return-sql";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const affiliateCode = request.headers.get("x-affiliate-code");
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter");

    if (!affiliateCode) {
      return NextResponse.json(
        { success: false, error: "Affiliate code required" },
        { status: 400 },
      );
    }

    const userResult = await pool.query(
      "SELECT id FROM affiliate_user WHERE refer_code = $1",
      [affiliateCode],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Affiliate not found" },
        { status: 404 },
      );
    }

    await syncAffiliateCommissionStatuses(pool, {
      affiliateCode,
      logPrefix: "[Affiliate Earnings]",
    });

    const rateRes = await pool.query(
      `SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`,
    );
    const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || "0");
    const affiliateRateDecimal = affiliateRateRaw / 100;

    const statsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN COALESCE(affiliate_commission, commission_amount * ${affiliateRateDecimal}) ELSE 0 END), 0) AS total_earned,
         COALESCE(SUM(CASE WHEN status = 'PENDING' THEN COALESCE(affiliate_commission, commission_amount * ${affiliateRateDecimal}) ELSE 0 END), 0) AS pending_earnings,
         COUNT(*)::int AS total_transactions
       FROM affiliate_commission_log
       WHERE affiliate_code = $1`,
      [affiliateCode],
    );

    const statsRow = statsResult.rows[0] || {};

    let filterClause = "";
    if (filter === "pending") {
      filterClause = " AND acl.status = 'PENDING'";
    } else if (filter === "returns") {
      filterClause = ` AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})`;
    }

    const transactionsResult = await pool.query(
      `SELECT
         acl.id,
         acl.order_id,
         acl.product_name,
         acl.customer_name,
         acl.customer_email,
         acl.order_amount,
         acl.commission_rate,
         COALESCE(acl.affiliate_commission, acl.commission_amount * ${affiliateRateDecimal}) AS affiliate_commission,
         acl.commission_source,
         acl.status,
         acl.unlock_at,
         acl.credited_at,
         acl.created_at,
         (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
         (${COMMISSION_HAS_PENDING_RETURN_REQUEST_SQL}) AS has_return_request
       FROM affiliate_commission_log acl
       WHERE acl.affiliate_code = $1${filterClause}
       ORDER BY acl.created_at DESC`,
      [affiliateCode],
    );

    const recentTransactions = transactionsResult.rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      product_name: row.product_name,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      order_amount: parseFloat(row.order_amount || "0"),
      commission_rate: parseFloat(row.commission_rate || "0"),
      commission_amount:
        row.status === "CANCELLED" ? 0 : parseFloat(row.affiliate_commission || "0"),
      commission_source: row.commission_source,
      status: row.status,
      unlock_at: row.unlock_at,
      credited_at: row.credited_at,
      has_return: !!row.has_return,
      has_return_request: !!row.has_return_request,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalEarned: parseFloat(statsRow.total_earned || "0"),
        pendingEarnings: parseFloat(statsRow.pending_earnings || "0"),
        totalTransactions: parseInt(statsRow.total_transactions || "0", 10),
      },
      recentTransactions,
    });
  } catch (error: unknown) {
    console.error("[affiliate/earnings] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
