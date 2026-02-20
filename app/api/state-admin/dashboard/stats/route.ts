import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');

        if (!state) {
            return NextResponse.json({ success: false, error: "State parameter is required" }, { status: 400 });
        }

        console.log("State Admin Stats - Fetching for state:", state);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get branches from stores table in this state
        const branchesQuery = `
            SELECT COUNT(*) as total, COUNT(DISTINCT city) as cities
            FROM stores 
            WHERE state ILIKE $1
        `;
        const branchesResult = await pool.query(branchesQuery, [state]);
        const totalBranches = parseInt(branchesResult.rows[0]?.total || '0');
        const totalASMs = parseInt(branchesResult.rows[0]?.cities || '0');

        // Get total agents linked to branches in this state
        const agentsQuery = `
            SELECT COUNT(*) as total_agents 
            FROM affiliate_user u
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1 AND u.is_agent = true
        `;
        const agentsResult = await pool.query(agentsQuery, [state]);
        const totalAgents = parseInt(agentsResult.rows[0]?.total_agents || '0');

        // Get total orders and commission in this state (using stores table)
        let totalOrders = 0;
        let totalCommission = 0;
        let pendingCommission = 0;
        let creditedCommission = 0;
        try {
            const ordersQuery = `
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(acl.affiliate_commission), 0) as total_commission,
                    COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.affiliate_commission ELSE 0 END), 0) as pending_commission,
                    COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.affiliate_commission ELSE 0 END), 0) as credited_commission
                FROM affiliate_commission_log acl
                JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
                JOIN stores s ON u.branch ILIKE s.branch_name
                WHERE s.state ILIKE $1
            `;
            const ordersResult = await pool.query(ordersQuery, [state]);
            totalOrders = parseInt(ordersResult.rows[0]?.total_orders || '0');
            totalCommission = parseFloat(ordersResult.rows[0]?.total_commission || '0');
            pendingCommission = parseFloat(ordersResult.rows[0]?.pending_commission || '0');
            creditedCommission = parseFloat(ordersResult.rows[0]?.credited_commission || '0');
        } catch (err) {
            console.error("Failed to get orders:", err);
            pendingCommission = 0;
            creditedCommission = 0;
        }


        const stats = {
            totalASMs,
            totalBranches,
            totalAgents,
            totalCommission,
            totalOrders,
            pending_commission: pendingCommission,
            credited_commission: creditedCommission
        };

        console.log("State Admin Stats:", stats);

        return NextResponse.json({
            success: true,
            stats
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch state admin stats:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
