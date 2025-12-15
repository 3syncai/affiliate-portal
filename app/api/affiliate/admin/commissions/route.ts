import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Fetching Total Commission Data ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });
        console.log("Database connected");

        // Query to get all affiliate users with their wallet and commission details
        const query = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.refer_code as referral_code,
        u.phone,
        COALESCE(w.coins_balance, 0) as wallet_amount,
        COALESCE(SUM(c.commission_amount), 0) as total_commission,
        COALESCE(SUM(c.commission_amount), 0) - COALESCE(w.coins_balance, 0) as pending_amount,
        COUNT(DISTINCT c.order_id) as total_orders
      FROM affiliate_user u
      LEFT JOIN customer_wallet w ON u.id = w.customer_id
      LEFT JOIN affiliate_commission_log c ON u.refer_code = c.affiliate_code
      GROUP BY 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.refer_code, 
        u.phone, 
        w.coins_balance
      ORDER BY total_commission DESC
    `;

        const result = await pool.query(query);
        console.log(`Query executed. Found ${result.rows.length} affiliates`);

        const affiliates = result.rows.map(row => ({
            user_id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            referral_code: row.referral_code,
            phone: row.phone,
            wallet_amount: parseFloat(row.wallet_amount) || 0,
            total_commission: parseFloat(row.total_commission) || 0,
            pending_amount: parseFloat(row.pending_amount) || 0,
            total_orders: parseInt(row.total_orders) || 0
        }));

        await pool.end();

        console.log(`Returning ${affiliates.length} affiliates`);
        return NextResponse.json({
            success: true,
            affiliates,
            count: affiliates.length
        });

    } catch (error) {
        console.error("Failed to fetch commission data:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch commission data",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
