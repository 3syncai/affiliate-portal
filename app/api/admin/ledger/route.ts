import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";
import {
  ledgerDisplayCommissionSql,
  ledgerOriginalCommissionSql,
} from "@/lib/ledger-commission-display";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "ALL";
        const offset = (page - 1) * limit;

        const rateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
        const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || '0');
        const affiliateRateDecimal = affiliateRateRaw / 100;

        const displayCommission = ledgerDisplayCommissionSql(affiliateRateDecimal);
        const originalCommission = ledgerOriginalCommissionSql(affiliateRateDecimal);

        let query = `
      SELECT 
        acl.id,
        acl.created_at,
        acl.order_id,
        acl.product_name,
        acl.quantity,
        acl.item_price,
        acl.order_amount,
        acl.commission_amount,
        ${displayCommission} AS affiliate_commission,
        ${originalCommission} AS original_commission,
        acl.branch_admin_bonus,
        acl.status,
        acl.commission_source,
        (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
        COALESCE(
          NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), ''),
          NULLIF(TRIM(CONCAT(sa.first_name, ' ', sa.last_name)), ''),
          NULLIF(TRIM(CONCAT(asm.first_name, ' ', asm.last_name)), ''),
          NULLIF(TRIM(CONCAT(ba.first_name, ' ', ba.last_name)), '')
        ) as first_name,
        '' as last_name,
        COALESCE(au.email, sa.email, asm.email, ba.email) as email,
        COALESCE(au.refer_code, sa.refer_code, asm.refer_code, ba.refer_code, acl.affiliate_code) as refer_code,
        au.is_agent,
        COALESCE(
          NULLIF(TRIM(CONCAT(
            NULLIF(TRIM(ship.city), ''),
            CASE
              WHEN ship.province IS NOT NULL AND TRIM(ship.province) <> ''
              THEN ', ' || TRIM(ship.province)
              ELSE ''
            END,
            CASE
              WHEN ship.postal_code IS NOT NULL AND TRIM(ship.postal_code) <> ''
              THEN ' - ' || TRIM(ship.postal_code)
              ELSE ''
            END
          )), ''),
          NULLIF(TRIM(o.metadata->>'shipping_state'), '')
        ) AS sale_location,
        sale.sale_by_name,
        sale.sale_by_code
      FROM affiliate_commission_log acl
      LEFT JOIN "order" o ON o.id = acl.order_id
      LEFT JOIN order_address ship ON ship.id = o.shipping_address_id
      LEFT JOIN LATERAL (
        SELECT
          NULLIF(TRIM(CONCAT(se_au.first_name, ' ', se_au.last_name)), '') AS sale_by_name,
          se_au.refer_code AS sale_by_code
        FROM affiliate_commission_log se
        LEFT JOIN affiliate_user se_au ON se_au.refer_code = se.affiliate_code
        WHERE se.order_id = acl.order_id
          AND se.commission_source = 'affiliate'
        ORDER BY se.created_at ASC
        LIMIT 1
      ) sale ON TRUE
      LEFT JOIN affiliate_user au
        ON au.refer_code = acl.affiliate_code
        OR au.id::text = NULLIF(acl.affiliate_user_id, '')
      LEFT JOIN state_admin sa
        ON sa.id::text = NULLIF(acl.affiliate_user_id, '')
        OR sa.refer_code = acl.affiliate_code
      LEFT JOIN area_sales_manager asm
        ON asm.id::text = NULLIF(acl.affiliate_user_id, '')
        OR asm.refer_code = acl.affiliate_code
      LEFT JOIN branch_admin ba
        ON ba.id::text = NULLIF(acl.affiliate_user_id, '')
        OR ba.refer_code = NULLIF(acl.branch_admin_code, '')
        OR ba.refer_code = acl.affiliate_code
      WHERE 1=1
    `;

        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (
        acl.order_id ILIKE $${paramIndex} OR 
        acl.product_name ILIKE $${paramIndex} OR 
        COALESCE(
          NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), ''),
          NULLIF(TRIM(CONCAT(sa.first_name, ' ', sa.last_name)), ''),
          NULLIF(TRIM(CONCAT(asm.first_name, ' ', asm.last_name)), ''),
          NULLIF(TRIM(CONCAT(ba.first_name, ' ', ba.last_name)), '')
        ) ILIKE $${paramIndex} OR
        COALESCE(au.email, sa.email, asm.email, ba.email) ILIKE $${paramIndex} OR
        COALESCE(au.refer_code, sa.refer_code, asm.refer_code, ba.refer_code, acl.affiliate_code) ILIKE $${paramIndex}
      )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status === "RETURNED") {
            query += ` AND (${COMMISSION_HAS_RETURN_SQL})`;
        } else if (status === "CANCELLED") {
            query += ` AND acl.status = 'CANCELLED' AND NOT (${COMMISSION_HAS_RETURN_SQL})`;
        } else if (status && status !== "ALL") {
            query += ` AND acl.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        // Count query
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as t`;

        // Add sorting and pagination
        query += ` ORDER BY acl.created_at DESC`;

        if (limit !== -1) {
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
        }

        // Execute queries
        const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
        const total = parseInt(countResult.rows[0].total);

        const result = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                page,
                limit: limit === -1 ? total : limit,
                totalPages: limit === -1 ? 1 : Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error("Error fetching ledger:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
