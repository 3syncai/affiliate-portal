import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
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
      logPrefix: "[State Admin Returns]",
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
       JOIN stores s ON u.branch ILIKE s.branch_name
       LEFT JOIN LATERAL (
         SELECT status, created_at
         FROM return_request rr
         WHERE rr.order_id = acl.order_id
           AND rr.deleted_at IS NULL
         ORDER BY rr.created_at DESC
         LIMIT 1
       ) rr ON true
       WHERE s.state ILIKE $1
         AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
       ORDER BY acl.order_id, acl.created_at DESC`,
      [state],
    );

    await pool.end();

    const { stats, orders } = buildReturnsResponse(result.rows);

    return NextResponse.json({
      success: true,
      stats,
      orders,
    });
  } catch (error: unknown) {
    console.error("[state-admin/returns] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
