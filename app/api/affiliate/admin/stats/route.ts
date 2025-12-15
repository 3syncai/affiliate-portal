import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Fetching Dashboard Stats ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });
        console.log("Database connected");

        // Get total agents count (approved users)
        const totalAgentsQuery = `SELECT COUNT(*) as count FROM affiliate_user WHERE is_approved = true`;
        const totalAgentsResult = await pool.query(totalAgentsQuery);
        const totalAgents = parseInt(totalAgentsResult.rows[0]?.count) || 0;

        // Get pending requests count (not yet approved)
        const pendingRequestsQuery = `SELECT COUNT(*) as count FROM affiliate_user WHERE is_approved = false`;
        const pendingRequestsResult = await pool.query(pendingRequestsQuery);
        const pendingRequests = parseInt(pendingRequestsResult.rows[0]?.count) || 0;

        // Get total commission
        const totalCommissionQuery = `
      SELECT COALESCE(SUM(commission_amount), 0) as total 
      FROM affiliate_commission_log
    `;
        const totalCommissionResult = await pool.query(totalCommissionQuery);
        const totalCommission = parseFloat(totalCommissionResult.rows[0]?.total) || 0;

        // Get pending payout (sum of wallet balances)
        const pendingPayoutQuery = `
      SELECT COALESCE(SUM(w.coins_balance), 0) as total 
      FROM customer_wallet w
      INNER JOIN affiliate_user u ON u.id = w.customer_id
    `;
        const pendingPayoutResult = await pool.query(pendingPayoutQuery);
        const pendingPayout = parseFloat(pendingPayoutResult.rows[0]?.total) || 0;

        // Get total orders
        const totalOrdersQuery = `
      SELECT COUNT(DISTINCT order_id) as count 
      FROM affiliate_commission_log
    `;
        const totalOrdersResult = await pool.query(totalOrdersQuery);
        const totalOrders = parseInt(totalOrdersResult.rows[0]?.count) || 0;

        await pool.end();

        const stats = {
            totalAgents,
            pendingRequests,
            totalCommission,
            pendingPayout,
            totalOrders
        };

        console.log("Dashboard stats:", stats);

        return NextResponse.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch dashboard stats",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
