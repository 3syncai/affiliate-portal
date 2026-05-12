import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";

export const dynamic = "force-dynamic";

async function syncDeliveredCommissions(pool: Pool, logPrefix: string) {
    try {
        const orderTableRes = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('order', 'orders')
            LIMIT 1
        `
        );

        if (orderTableRes.rows.length === 0) {
            console.warn(`${logPrefix} Status sync skipped: order table not found`);
            return;
        }

        const orderTable = orderTableRes.rows[0].table_name;
        const orderColsRes = await pool.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
        `,
            [orderTable]
        );
        const orderCols = new Set(orderColsRes.rows.map((row: { column_name: string }) => row.column_name));

        const conditions: string[] = [];
        if (orderCols.has("fulfillment_status")) {
            conditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('delivered','fulfilled','shipped')");
        }
        if (orderCols.has("payment_status")) {
            conditions.push("LOWER(COALESCE(o.payment_status::text, '')) IN ('captured','partially_captured')");
        }
        if (orderCols.has("status")) {
            conditions.push("LOWER(COALESCE(o.status::text, '')) IN ('completed')");
        }
        if (orderCols.has("metadata")) {
            conditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'delivered'");
            conditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'fulfilled'");
            conditions.push("o.metadata->>'shiprocket_delivered_at' IS NOT NULL");
        }

        const extraAnd: string[] = [];
        if (orderCols.has("canceled_at")) {
            extraAnd.push("o.canceled_at IS NULL");
        }

        let joinClause = "";
        const fulfillmentTableRes = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'fulfillment'
            LIMIT 1
        `
        );

        if (fulfillmentTableRes.rows.length > 0) {
            const fulfillmentColsRes = await pool.query(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fulfillment'
            `
            );
            const fulfillmentCols = new Set(
                fulfillmentColsRes.rows.map((row: { column_name: string }) => row.column_name)
            );

            if (fulfillmentCols.has("order_id")) {
                joinClause = "LEFT JOIN fulfillment f ON f.order_id = o.id";
            } else {
                const orderFulfillmentTableRes = await pool.query(
                    `
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'order_fulfillment'
                    LIMIT 1
                `
                );

                if (orderFulfillmentTableRes.rows.length > 0) {
                    joinClause = `
                    LEFT JOIN order_fulfillment ofl ON ofl.order_id = o.id
                    LEFT JOIN fulfillment f ON f.id = ofl.fulfillment_id
                `;
                }
            }

            if (joinClause) {
                if (fulfillmentCols.has("delivered_at")) {
                    conditions.push("f.delivered_at IS NOT NULL");
                }
                if (fulfillmentCols.has("shipped_at")) {
                    conditions.push("f.shipped_at IS NOT NULL");
                }
                if (fulfillmentCols.has("status")) {
                    conditions.push("LOWER(COALESCE(f.status::text, '')) IN ('delivered','fulfilled','shipped')");
                }
                if (fulfillmentCols.has("canceled_at")) {
                    extraAnd.push("f.canceled_at IS NULL");
                }
            }
        }

        if (conditions.length === 0) {
            console.warn(`${logPrefix} Status sync skipped: no usable status columns found`);
            return;
        }

        const whereClause = conditions.join(" OR ");
        const extraClause = extraAnd.length > 0 ? `AND ${extraAnd.join(" AND ")}` : "";

        await pool.query(`
            UPDATE affiliate_commission_log acl
            SET status = 'CREDITED',
                credited_at = COALESCE(acl.credited_at, NOW())
            FROM "${orderTable}" o
            ${joinClause}
            WHERE o.id = acl.order_id
              AND acl.status IS DISTINCT FROM 'CREDITED'
              AND (${whereClause})
              ${extraClause}
        `);
    } catch (syncError) {
        console.warn(`${logPrefix} Status sync skipped:`, syncError);
    }
}

export async function GET(req: NextRequest) {
    console.log("=== Fetching State Affiliate Orders ===");

    try {
        const { searchParams } = new URL(req.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) {
            return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[State Admin Orders]" });
        await syncDeliveredCommissions(pool, "[State Admin Orders]");

        const adminResult = await pool.query(
            `SELECT refer_code FROM state_admin WHERE id = $1`,
            [adminId]
        );
        const stateReferCode = adminResult.rows[0]?.refer_code || "";
        const stateReferCodeLower = stateReferCode.toLowerCase();

        // State Admins can see their own overrides, direct sales, and full downline.
        const validSources = ['state_admin', 'state_admin_direct', 'area_manager', 'asm_direct', 'branch_admin', 'affiliate'];

        // Query to get downline affiliate orders for this specific state admin
        // 1. We find all order_ids where this admin earned a commission
        // 2. For those order_ids, we grab the commission logs that match the downline sources
        const query = `
            WITH AdminOrders AS (
                SELECT DISTINCT order_id 
                FROM affiliate_commission_log 
                WHERE affiliate_user_id = $1
                   OR (
                        commission_source IN ('state_admin_direct', 'state_admin')
                        AND LOWER(affiliate_code) = LOWER($3)
                   )
            )
            SELECT 
                acl.id,
                acl.order_id,
                acl.affiliate_user_id,
                acl.affiliate_code,
                acl.product_name,
                acl.quantity,
                acl.item_price,
                acl.order_amount,
                acl.commission_rate,
                acl.commission_amount,
                acl.affiliate_commission,
                acl.commission_source,
                acl.status,
                acl.created_at,
                u.first_name as affiliate_first_name,
                u.last_name as affiliate_last_name,
                u.email as affiliate_email,
                ba.first_name as branch_first_name,
                ba.last_name as branch_last_name,
                ba.email as branch_email,
                asm.first_name as asm_first_name,
                asm.last_name as asm_last_name,
                asm.email as asm_email,
                sa.first_name as state_first_name,
                sa.last_name as state_last_name,
                sa.email as state_email,
                acl.customer_id
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            LEFT JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            LEFT JOIN area_sales_manager asm ON acl.affiliate_code = asm.refer_code
            LEFT JOIN state_admin sa ON acl.affiliate_code = sa.refer_code
            JOIN AdminOrders ao ON acl.order_id = ao.order_id
            WHERE acl.commission_source = ANY($2::text[])
            ORDER BY acl.created_at ASC
        `;

        const result = await pool.query(query, [adminId, validSources, stateReferCode]);

        const orderMap = new Map<string, any>();

        for (const row of result.rows) {
            if (!orderMap.has(row.order_id)) {
                orderMap.set(row.order_id, {
                    id: row.order_id,
                    order_id: row.order_id,
                    product_name: row.product_name,
                    quantity: parseInt(row.quantity) || 0,
                    item_price: parseFloat(row.item_price) || 0,
                    order_amount: parseFloat(row.order_amount) || 0,
                    status: row.status,
                    created_at: row.created_at,
                    customer_id: row.customer_id,

                    generator_code: null,
                    generator_name: null,
                    generator_email: null,
                    source_rank: 999,

                    affiliate_earned: 0,
                    branch_earned: 0,
                    asm_earned: 0,
                    my_earned: 0,
                });
            }

            const grouped = orderMap.get(row.order_id);
            const amount = parseFloat(row.affiliate_commission) || 0;

            if (row.commission_source === 'affiliate') {
                grouped.affiliate_earned = amount;
            }

            if (row.commission_source === 'branch_admin') {
                grouped.branch_earned = amount;
            }

            if (row.commission_source === 'area_manager' || row.commission_source === 'asm_direct') {
                grouped.asm_earned += amount;
            }

            if (
                String(row.affiliate_user_id || "") === String(adminId) ||
                (
                    (row.commission_source === 'state_admin_direct' || row.commission_source === 'state_admin') &&
                    String(row.affiliate_code || "").toLowerCase() === stateReferCodeLower
                )
            ) {
                grouped.my_earned += amount;
            }

            // Find the bottom-most referrer (1=affiliate, 2=branch_admin, 3=ASM, 4=state_admin)
            let rank = 999;
            if (row.commission_source === 'affiliate') rank = 1;
            else if (row.commission_source === 'branch_admin') rank = 2;
            else if (row.commission_source === 'area_manager' || row.commission_source === 'asm_direct') rank = 3;
            else if (row.commission_source === 'state_admin' || row.commission_source === 'state_admin_direct') rank = 4;

            if (rank < grouped.source_rank) {
                grouped.source_rank = rank;
                grouped.generator_code = row.affiliate_code;
                grouped.generator_name =
                    row.affiliate_first_name && row.affiliate_last_name
                        ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                        : row.branch_first_name && row.branch_last_name
                            ? `${row.branch_first_name} ${row.branch_last_name}`
                            : row.asm_first_name && row.asm_last_name
                                ? `${row.asm_first_name} ${row.asm_last_name}`
                                : row.state_first_name && row.state_last_name
                                    ? `${row.state_first_name} ${row.state_last_name}`
                                    : row.affiliate_code;
                grouped.generator_email = row.affiliate_email || row.branch_email || row.asm_email || row.state_email || null;
            }
        }

        const orders = Array.from(orderMap.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        await pool.end();

        return NextResponse.json({
            success: true,
            orders,
            count: orders.length
        });

    } catch (error: any) {
        console.error("Failed to fetch state orders:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch orders",
                message: error.message || "Unknown error"
            },
            { status: 500 }
        );
    }
}
