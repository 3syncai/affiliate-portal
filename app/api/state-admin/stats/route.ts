import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching State Admin Stats ===");

    try {
        const { searchParams } = new URL(request.url);
        const state = searchParams.get('state');

        if (!state) {
            return NextResponse.json(
                { success: false, error: "State parameter is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get total agents in state (approved users who are agents)
        const totalAgentsResult = await pool.query(
            `SELECT COUNT(*) as count FROM affiliate_user 
             WHERE state = $1 AND is_approved = true AND is_agent = true`,
            [state]
        );
        const totalAgents = parseInt(totalAgentsResult.rows[0]?.count) || 0;

        // Get pending agents in state
        const pendingAgentsResult = await pool.query(
            `SELECT COUNT(*) as count FROM affiliate_user 
             WHERE state = $1 AND is_approved = false AND is_agent = true`,
            [state]
        );
        const pendingAgents = parseInt(pendingAgentsResult.rows[0]?.count) || 0;

        // Get total commission for agents in state
        const commissionResult = await pool.query(
            `SELECT COALESCE(SUM(acl.commission_amount), 0) as total_commission
             FROM affiliate_commission_log acl
             JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
             WHERE au.state = $1`,
            [state]
        );
        const totalCommission = parseFloat(commissionResult.rows[0]?.total_commission) || 0;

        // Get total orders for agents in state
        const ordersResult = await pool.query(
            `SELECT COUNT(*) as count
             FROM affiliate_commission_log acl
             JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
             WHERE au.state = $1`,
            [state]
        );
        const totalOrders = parseInt(ordersResult.rows[0]?.count) || 0;

        await pool.end();

        const stats = {
            totalAgents,
            pendingAgents,
            totalCommission,
            totalOrders
        };

        console.log(`State ${state} stats:`, stats);

        return NextResponse.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error("Failed to fetch state admin stats:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch stats",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
