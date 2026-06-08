import { NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureAdditionalCommissionSchema } from "@/lib/additional-commission";
import { COMMISSION_IS_RETURN_OR_CANCELLED_SQL } from "@/lib/dashboard-return-sql";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Fetching Dashboard Stats ===");

    try {
        await ensureAdditionalCommissionSchema();

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
      SELECT COALESCE(SUM(COALESCE(affiliate_commission, commission_amount)), 0) as total 
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

        // Get total orders and returns
        const ordersQuery = `
      SELECT
        COUNT(DISTINCT order_id)::int AS total_orders,
        COUNT(DISTINCT order_id) FILTER (
          WHERE ${COMMISSION_IS_RETURN_OR_CANCELLED_SQL}
        )::int AS total_returns
      FROM affiliate_commission_log acl
    `;
        const ordersResult = await pool.query(ordersQuery);
        const totalOrders = parseInt(ordersResult.rows[0]?.total_orders) || 0;
        const totalReturns = parseInt(ordersResult.rows[0]?.total_returns) || 0;

        await pool.end();

        const stats = {
            totalAgents,
            pendingRequests,
            totalCommission,
            pendingPayout,
            totalOrders,
            totalReturns,
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
