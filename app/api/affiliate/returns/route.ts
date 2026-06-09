import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import {
  COMMISSION_HAS_RETURN_SQL,
  COMMISSION_IS_RETURN_OR_CANCELLED_SQL,
} from "@/lib/dashboard-return-sql";
import { buildReturnsResponse } from "@/lib/returns-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const affiliateCode = request.headers.get("x-affiliate-code");

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
      logPrefix: "[Affiliate Returns]",
    });

    const result = await pool.query(
      `SELECT DISTINCT ON (acl.order_id)
         acl.order_id,
         acl.product_name,
         acl.customer_name,
         acl.customer_email,
         acl.order_amount,
         acl.status AS commission_status,
         acl.created_at,
         (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
         rr.status AS return_status,
         rr.created_at AS return_requested_at
       FROM affiliate_commission_log acl
       LEFT JOIN LATERAL (
         SELECT status, created_at
         FROM return_request rr
         WHERE rr.order_id = acl.order_id
           AND rr.deleted_at IS NULL
         ORDER BY rr.created_at DESC
         LIMIT 1
       ) rr ON true
       WHERE acl.affiliate_code = $1
         AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
       ORDER BY acl.order_id, acl.created_at DESC`,
      [affiliateCode],
    );

    const { stats, orders } = buildReturnsResponse(result.rows);

    return NextResponse.json({
      success: true,
      stats,
      orders,
    });
  } catch (error: unknown) {
    console.error("[affiliate/returns] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
