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
    const branch = searchParams.get("branch");
    const adminId = searchParams.get("adminId");

    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch parameter is required" },
        { status: 400 },
      );
    }

    let referCode = searchParams.get("refer_code") || "";
    if (adminId) {
      const adminRow = await pool.query(
        `SELECT refer_code FROM branch_admin WHERE id = $1 LIMIT 1`,
        [adminId],
      );
      referCode = adminRow.rows[0]?.refer_code || referCode;
    }

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[Branch Returns]",
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
      SELECT DISTINCT ON (order_id) *
      FROM (
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
        ${returnLateral}
        WHERE u.branch ILIKE $1
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
          'Sales Executive Sale' AS sale_type,
          TRIM(CONCAT(au.first_name, ' ', au.last_name)) AS referrer_name,
          au.refer_code AS refer_code
        FROM affiliate_commission_log acl
        LEFT JOIN affiliate_user au
          ON LOWER(TRIM(au.refer_code)) = LOWER(TRIM(acl.affiliate_code))
        ${returnLateral}
        WHERE acl.commission_source = 'branch_admin'
          AND acl.affiliate_user_id = $2
          AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) <> LOWER(TRIM($3))
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
        WHERE acl.commission_source = 'branch_admin'
          AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($3))
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )
      ) returns_union
      ORDER BY
        order_id,
        CASE referral_category WHEN 'self' THEN 0 ELSE 1 END,
        COALESCE(return_requested_at, created_at) DESC
      `,
      [branch, adminId || "", referCode || ""],
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
