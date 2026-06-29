import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";
import {
  ledgerDisplayCommissionSql,
} from "@/lib/ledger-commission-display";
import {
  RETURN_REQUEST_APPROVED_STATUSES,
  RETURN_REQUEST_PENDING_STATUSES,
  RETURN_REQUEST_REJECTED_STATUSES,
  returnStatusSqlList,
} from "@/lib/return-request-status";

export const dynamic = "force-dynamic";

const REJECTED_SQL = returnStatusSqlList(RETURN_REQUEST_REJECTED_STATUSES);
const APPROVED_SQL = returnStatusSqlList(RETURN_REQUEST_APPROVED_STATUSES);
const PENDING_SQL = returnStatusSqlList(RETURN_REQUEST_PENDING_STATUSES);

/**
 * Referral-code orders (commission_source = affiliate) with an active
 * customer return request — same row shape as the commission ledger API.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";
    const offset = (page - 1) * limit;

    await syncAffiliateCommissionStatuses(pool, {
      logPrefix: "[Admin Returns]",
    });

    const rateRes = await pool.query(
      `SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`,
    );
    const affiliateRateRaw = parseFloat(
      rateRes.rows[0]?.commission_percentage || "0",
    );
    const affiliateRateDecimal = affiliateRateRaw / 100;
    const displayCommission = ledgerDisplayCommissionSql(affiliateRateDecimal);

    let query = `
      SELECT
        acl.id,
        acl.created_at,
        acl.order_id,
        acl.product_name,
        acl.quantity,
        acl.order_amount,
        acl.commission_amount,
        ${displayCommission} AS affiliate_commission,
        acl.branch_admin_bonus,
        acl.status,
        acl.commission_source,
        acl.unlock_at,
        COALESCE(
          NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), ''),
          ''
        ) AS first_name,
        '' AS last_name,
        COALESCE(au.email, '') AS email,
        COALESCE(au.refer_code, acl.affiliate_code) AS refer_code,
        COALESCE(au.is_agent, true) AS is_agent,
        rr.status AS return_status,
        rr.created_at AS return_requested_at,
        (${COMMISSION_HAS_RETURN_SQL}) AS has_return
      FROM affiliate_commission_log acl
      INNER JOIN LATERAL (
        SELECT status, created_at
        FROM return_request rr_inner
        WHERE rr_inner.order_id = acl.order_id
          AND rr_inner.deleted_at IS NULL
          AND LOWER(COALESCE(rr_inner.status, '')) NOT IN (${REJECTED_SQL})
        ORDER BY rr_inner.created_at DESC
        LIMIT 1
      ) rr ON true
      LEFT JOIN affiliate_user au
        ON au.refer_code = acl.affiliate_code
        OR au.id::text = NULLIF(acl.affiliate_user_id, '')
      WHERE acl.commission_source = 'affiliate'
        AND TRIM(COALESCE(acl.affiliate_code, '')) <> ''
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (
        acl.order_id ILIKE $${paramIndex}
        OR acl.product_name ILIKE $${paramIndex}
        OR au.first_name ILIKE $${paramIndex}
        OR au.last_name ILIKE $${paramIndex}
        OR au.email ILIKE $${paramIndex}
        OR acl.affiliate_code ILIKE $${paramIndex}
        OR COALESCE(au.refer_code, acl.affiliate_code) ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status === "AWAITING_APPROVAL") {
      query += ` AND LOWER(COALESCE(rr.status, '')) IN (${PENDING_SQL})`;
    } else if (status === "APPROVED") {
      query += ` AND LOWER(COALESCE(rr.status, '')) IN (${APPROVED_SQL})`;
    } else if (status === "RETURNED") {
      query += ` AND (${COMMISSION_HAS_RETURN_SQL})`;
    } else if (status && status !== "ALL") {
      query += ` AND acl.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*)::int AS total FROM (${query}) AS t`;
    query += ` ORDER BY rr.created_at DESC, acl.created_at DESC`;

    if (limit !== -1) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
    }

    const countParams = params.slice(0, paramIndex - 1);
    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0]?.total ?? 0;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit: limit === -1 ? total : limit,
        totalPages: limit === -1 ? 1 : Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    console.error("[admin/returns] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
