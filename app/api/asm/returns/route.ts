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
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!city || !state) {
      return NextResponse.json(
        { success: false, error: "City and state parameters are required" },
        { status: 400 },
      );
    }

    let asmReferCode = searchParams.get("refer_code") || "";
    if (adminId) {
      const asmRow = await pool.query(
        `SELECT refer_code FROM area_sales_manager WHERE id = $1 LIMIT 1`,
        [adminId],
      );
      asmReferCode = asmRow.rows[0]?.refer_code || asmReferCode;
    }

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[ASM Returns]",
    });

    const returnLateralFor = (orderIdRef: string) => `
      LEFT JOIN LATERAL (
        SELECT status, created_at
        FROM return_request rr
        WHERE rr.order_id = ${orderIdRef}
          AND rr.deleted_at IS NULL
          AND LOWER(COALESCE(rr.status, '')) NOT IN (${REJECTED_SQL})
        ORDER BY rr.created_at DESC
        LIMIT 1
      ) rr ON true
    `;

    const returnLateral = returnLateralFor("acl.order_id");
    const returnLateralAsm = returnLateralFor("acl_asm.order_id");

    const asmHasReturnSql = COMMISSION_HAS_RETURN_SQL.replace(/acl\./g, "acl_asm.");
    const asmReturnOrCancelledSql = COMMISSION_IS_RETURN_OR_CANCELLED_SQL.replace(
      /acl\./g,
      "acl_asm.",
    );

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
        JOIN stores s ON u.branch ILIKE s.branch_name
        ${returnLateral}
        WHERE s.city ILIKE $1
          AND s.state ILIKE $2
          AND acl.commission_source = 'affiliate'
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )

        UNION ALL

        (
        SELECT DISTINCT ON (acl_asm.order_id)
          acl_asm.order_id,
          acl_asm.product_name,
          acl_asm.customer_name,
          acl_asm.customer_email,
          acl_asm.order_amount,
          acl_asm.status AS commission_status,
          acl_asm.created_at,
          (${asmHasReturnSql}) AS has_return,
          rr.status AS return_status,
          rr.created_at AS return_requested_at,
          'team' AS referral_category,
          'Team Sales' AS sale_type,
          TRIM(CONCAT(ba.first_name, ' ', ba.last_name)) AS referrer_name,
          ba.refer_code AS refer_code
        FROM affiliate_commission_log acl_asm
        LEFT JOIN affiliate_commission_log acl_branch
          ON acl_asm.order_id = acl_branch.order_id
          AND acl_branch.commission_source = 'branch_admin'
        LEFT JOIN branch_admin ba
          ON acl_branch.affiliate_user_id = ba.id::text
        ${returnLateralAsm}
        WHERE acl_asm.commission_source = 'area_manager'
          AND acl_asm.affiliate_user_id = $3
          AND (${asmReturnOrCancelledSql})
        ORDER BY acl_asm.order_id, acl_asm.created_at DESC
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
        WHERE acl.commission_source = 'asm_direct'
          AND (
            acl.affiliate_user_id = $3
            OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM($4))
          )
          AND (${COMMISSION_IS_RETURN_OR_CANCELLED_SQL})
        ORDER BY acl.order_id, acl.created_at DESC
        )
      ) returns_union
      ORDER BY
        order_id,
        CASE referral_category WHEN 'self' THEN 0 ELSE 1 END,
        COALESCE(return_requested_at, created_at) DESC
      `,
      [city, state, adminId || "", asmReferCode || ""],
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
    console.error("[asm/returns] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
