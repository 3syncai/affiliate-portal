import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import {
  COMMISSION_HAS_RETURN_SQL,
  COMMISSION_IS_RETURN_OR_CANCELLED_SQL,
} from "@/lib/dashboard-return-sql";
import { buildReturnsResponse } from "@/lib/returns-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");

    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch parameter is required" },
        { status: 400 },
      );
    }

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[Branch Returns]",
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
       JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
       LEFT JOIN LATERAL (
         SELECT status, created_at
         FROM return_request rr
         WHERE rr.order_id = acl.order_id
           AND rr.deleted_at IS NULL
         ORDER BY rr.created_at DESC
         LIMIT 1
       ) rr ON true
       WHERE u.branch ILIKE $1
         AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
       ORDER BY acl.order_id, acl.created_at DESC`,
      [branch],
    );

    const { stats, orders } = buildReturnsResponse(result.rows);

    return NextResponse.json({
      success: true,
      stats,
      orders,
    });
  } catch (error: unknown) {
    console.error("[branch/returns] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
