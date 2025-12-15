import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Fetching Affiliate Orders ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });
        console.log("Database connected");

        // Query to get all affiliate orders with details
        const query = `
      SELECT 
        acl.id,
        acl.order_id,
        acl.affiliate_code,
        acl.product_name,
        acl.quantity,
        acl.item_price,
        acl.order_amount,
        acl.commission_rate,
        acl.commission_amount,
        acl.commission_source,
        acl.status,
        acl.created_at,
        u.first_name as affiliate_first_name,
        u.last_name as affiliate_last_name,
        u.email as affiliate_email,
        acl.customer_id
      FROM affiliate_commission_log acl
      LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
      ORDER BY acl.created_at DESC
    `;

        const result = await pool.query(query);
        console.log(`Query executed. Found ${result.rows.length} orders`);

        const orders = result.rows.map(row => ({
            id: row.id,
            order_id: row.order_id,
            affiliate_code: row.affiliate_code,
            affiliate_name: row.affiliate_first_name && row.affiliate_last_name
                ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                : row.affiliate_code,
            affiliate_email: row.affiliate_email,
            product_name: row.product_name,
            quantity: parseInt(row.quantity) || 0,
            item_price: parseFloat(row.item_price) || 0,
            order_amount: parseFloat(row.order_amount) || 0,
            commission_rate: parseFloat(row.commission_rate) || 0,
            commission_amount: parseFloat(row.commission_amount) || 0,
            commission_source: row.commission_source,
            status: row.status,
            created_at: row.created_at,
            customer_id: row.customer_id
        }));

        await pool.end();

        console.log(`Returning ${orders.length} orders`);
        return NextResponse.json({
            success: true,
            orders,
            count: orders.length
        });

    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch orders",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
