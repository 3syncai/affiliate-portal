import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Dashboard Stats ===");

    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        // Count total approved agents in this branch
        const totalAgentsResult = await pool.query(
            `SELECT COUNT(*) as count FROM affiliate_user 
             WHERE branch ILIKE $1 AND is_approved = true AND is_agent = true`,
            [branch]
        );

        // Count pending approval in this branch
        const pendingResult = await pool.query(
            `SELECT COUNT(*) as count FROM affiliate_user 
             WHERE branch ILIKE $1 AND is_approved = false AND is_agent = true`,
            [branch]
        );

        // Get total commission for agents in this branch (ONLY CREDITED)
        let totalCommission = 0;
        try {
            const commissionResult = await pool.query(
                `SELECT COALESCE(SUM(COALESCE(acl.affiliate_amount, acl.commission_amount * 0.70)), 0) as total 
                 FROM affiliate_commission_log acl
                 INNER JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                 WHERE au.branch ILIKE $1 AND acl.status = 'CREDITED'`,
                [branch]
            );
            totalCommission = parseFloat(commissionResult.rows[0]?.total || '0');
        } catch (error: unknown) {
            console.log("Commission query failed, using 0", error);
        }

        // Count total orders (from affiliate_commission_log)
        let totalOrders = 0;
        try {
            const ordersResult = await pool.query(
                `SELECT COUNT(*) as count FROM affiliate_commission_log acl
                 INNER JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                 WHERE au.branch ILIKE $1`,
                [branch]
            );
            totalOrders = parseInt(ordersResult.rows[0]?.count || '0');
        } catch (error: unknown) {
            console.log("Orders query failed, using 0", error);
        }

        const stats = {
            totalAgents: parseInt(totalAgentsResult.rows[0]?.count || '0'),
            pendingApproval: parseInt(pendingResult.rows[0]?.count || '0'),
            totalCommission,
            totalOrders
        };

        console.log(`Branch ${branch} stats:`, stats);

        return NextResponse.json({ success: true, stats });
    } catch (error: unknown) {
        console.error("Failed to fetch branch stats:", error);
        return NextResponse.json({
            success: true,
            stats: { totalAgents: 0, pendingApproval: 0, totalCommission: 0, totalOrders: 0 }
        });
    }
}
