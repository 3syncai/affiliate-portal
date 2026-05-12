
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "ALL";
        const offset = (page - 1) * limit;

        // Get affiliate rate
        const rateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
        const affiliateRateRaw = parseFloat(rateRes.rows[0]?.commission_percentage || '0');
        const affiliateRateDecimal = affiliateRateRaw / 100;


        // NOTE: For non-affiliate sources (state_admin / area_manager /
        // branch_admin) the `affiliate_code` column on the log is a generic
        // role tag like 'STATE' / 'AREA' / 'BRANCH', so we cannot match the
        // admin tables by refer_code. The actual link is `affiliate_user_id`
        // which holds the admin's UUID. We also wrap each CONCAT with
        // NULLIF(TRIM(...), '') because PostgreSQL's CONCAT returns a single
        // space (not NULL) when both name parts are NULL, which would
        // otherwise short-circuit the COALESCE chain.
        let query = `
      SELECT 
        acl.id,
        acl.created_at,
        acl.order_id,
        acl.product_name,
        acl.quantity,
        acl.order_amount,
        acl.commission_amount,
        COALESCE(acl.affiliate_commission, acl.commission_amount * ${affiliateRateDecimal}) as affiliate_commission,
        acl.branch_admin_bonus,
        acl.status,
        acl.commission_source,
        COALESCE(
          NULLIF(TRIM(CONCAT(au.first_name, ' ', au.last_name)), ''),
          NULLIF(TRIM(CONCAT(sa.first_name, ' ', sa.last_name)), ''),
          NULLIF(TRIM(CONCAT(asm.first_name, ' ', asm.last_name)), ''),
          NULLIF(TRIM(CONCAT(ba.first_name, ' ', ba.last_name)), '')
        ) as first_name,
        '' as last_name,
        COALESCE(au.email, sa.email, asm.email, ba.email) as email,
        COALESCE(au.refer_code, sa.refer_code, asm.refer_code, ba.refer_code, acl.affiliate_code) as refer_code,
        au.is_agent
      FROM affiliate_commission_log acl
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

        if (status && status !== "ALL") {
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
        const client = await pool.connect();
        try {
            const countResult = await client.query(countQuery, params.slice(0, paramIndex - 1));
            const total = parseInt(countResult.rows[0].total);

            const result = await client.query(query, params);

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
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("Error fetching ledger:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
