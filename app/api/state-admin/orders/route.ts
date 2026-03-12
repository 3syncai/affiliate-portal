import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

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
        
        // State Admins can see their own overrides, downline ASMs, downline Branch Admins, and bottom Affiliates
        const validSources = ['state_admin', 'area_manager', 'branch_admin', 'affiliate'];

        // Query to get downline affiliate orders for this specific state admin
        // 1. We find all order_ids where this admin earned a commission
        // 2. For those order_ids, we grab the commission logs that match the downline sources
        const query = `
            WITH AdminOrders AS (
                SELECT DISTINCT order_id 
                FROM affiliate_commission_log 
                WHERE affiliate_user_id = $1
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
                acl.customer_id
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN AdminOrders ao ON acl.order_id = ao.order_id
            WHERE acl.commission_source = ANY($2::text[])
            ORDER BY acl.created_at ASC
        `;

        const result = await pool.query(query, [adminId, validSources]);

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
                    my_earned: 0,
                });
            }

            const grouped = orderMap.get(row.order_id);
            const amount = parseFloat(row.affiliate_commission) || 0;

            if (row.commission_source === 'affiliate') {
                grouped.affiliate_earned = amount;
            }

            if (row.affiliate_user_id === adminId) {
                grouped.my_earned += amount;
            }

            // Find the bottom-most referrer (1=affiliate, 2=branch_admin, 3=area_manager, 4=state_admin)
            let rank = 999;
            if (row.commission_source === 'affiliate') rank = 1;
            else if (row.commission_source === 'branch_admin') rank = 2;
            else if (row.commission_source === 'area_manager') rank = 3;
            else if (row.commission_source === 'state_admin') rank = 4;

            if (rank < grouped.source_rank) {
                grouped.source_rank = rank;
                grouped.generator_code = row.affiliate_code;
                grouped.generator_name = row.affiliate_first_name && row.affiliate_last_name
                    ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                    : row.affiliate_code;
                grouped.generator_email = row.affiliate_email;
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
