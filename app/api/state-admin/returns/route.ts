import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import {
  COMMISSION_HAS_RETURN_SQL,
  COMMISSION_IS_RETURN_OR_CANCELLED_SQL,
} from "@/lib/dashboard-return-sql";
import {
  RETURN_REQUEST_REJECTED_STATUSES,
  returnStatusSqlList,
} from "@/lib/return-request-status";
import { buildReturnsResponse } from "@/lib/returns-response";

export const dynamic = "force-dynamic";

const REJECTED_SQL = returnStatusSqlList(RETURN_REQUEST_REJECTED_STATUSES);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!state) {
      return NextResponse.json(
        { success: false, error: "State parameter is required" },
        { status: 400 },
      );
    }

    let referCode = searchParams.get("refer_code") || "";
    if (adminId) {
      const adminRow = await pool.query(
        `SELECT refer_code FROM state_admin WHERE id = $1 LIMIT 1`,
        [adminId],
      );
      referCode = adminRow.rows[0]?.refer_code || referCode;
    }

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[State Admin Returns]",
    });

    const returnLateral = `
      LEFT JOIN LATERAL (
        SELECT status, created_at
        FROM return_request rr
        WHERE rr.order_id = acl.order_id
          AND rr.deleted_at IS NULL
          AND LOWER(COALESCE(rr.status, '')) NOT IN (${REJECTED_SQL})
        ORDER BY rr.created_at DESC
        LIMIT 1
      ) rr ON true
    `;

    const result = await pool.query(
      `
      SELECT * FROM (
        (
        SELECT DISTINCT ON (acl.order_id)
          acl.order_id,
          acl.product_name,
          acl.customer_name,
          acl.customer_email,
          acl.order_amount,
          acl.status AS commission_status,
          acl.created_at,
          (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
          rr.status AS return_status,
          rr.created_at AS return_requested_at,
          'team' AS referral_category,
          'Team Sales' AS sale_type,
          TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS referrer_name,
          u.refer_code AS refer_code
        FROM affiliate_commission_log acl
        JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
        JOIN stores s ON u.branch ILIKE s.branch_name
        ${returnLateral}
        WHERE s.state ILIKE $1
          AND acl.commission_source = 'affiliate'
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )

        UNION ALL

        (
        SELECT DISTINCT ON (acl.order_id)
          acl.order_id,
          acl.product_name,
          acl.customer_name,
          acl.customer_email,
          acl.order_amount,
          acl.status AS commission_status,
          acl.created_at,
          (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
          rr.status AS return_status,
          rr.created_at AS return_requested_at,
          'team' AS referral_category,
          'Team Sales' AS sale_type,
          TRIM(CONCAT(ba.first_name, ' ', ba.last_name)) AS referrer_name,
          ba.refer_code AS refer_code
        FROM affiliate_commission_log acl
        JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
        ${returnLateral}
        WHERE ba.state ILIKE $1
          AND acl.commission_source = 'branch_admin'
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )

        UNION ALL

        (
        SELECT DISTINCT ON (acl.order_id)
          acl.order_id,
          acl.product_name,
          acl.customer_name,
          acl.customer_email,
          acl.order_amount,
          acl.status AS commission_status,
          acl.created_at,
          (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
          rr.status AS return_status,
          rr.created_at AS return_requested_at,
          'team' AS referral_category,
          'Team Sales' AS sale_type,
          TRIM(CONCAT(asm.first_name, ' ', asm.last_name)) AS referrer_name,
          asm.refer_code AS refer_code
        FROM affiliate_commission_log acl
        JOIN area_sales_manager asm ON acl.affiliate_code = asm.refer_code
        ${returnLateral}
        WHERE asm.state ILIKE $1
          AND acl.commission_source = 'asm_direct'
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )

        UNION ALL

        (
        SELECT DISTINCT ON (acl.order_id)
          acl.order_id,
          acl.product_name,
          acl.customer_name,
          acl.customer_email,
          acl.order_amount,
          acl.status AS commission_status,
          acl.created_at,
          (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
          rr.status AS return_status,
          rr.created_at AS return_requested_at,
          'self' AS referral_category,
          'Self Referral' AS sale_type,
          'You' AS referrer_name,
          acl.affiliate_code AS refer_code
        FROM affiliate_commission_log acl
        ${returnLateral}
        WHERE acl.commission_source = 'state_admin_direct'
          AND LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM($2))
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )
      ) returns_union
      ORDER BY COALESCE(return_requested_at, created_at) DESC
      `,
      [state, referCode || ""],
    );

    const { stats, orders } = buildReturnsResponse(result.rows);

    const selfReturns = orders.filter((o) => o.referral_category === "self").length;
    const teamReturns = orders.filter((o) => o.referral_category === "team").length;

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        selfReturns,
        teamReturns,
      },
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
