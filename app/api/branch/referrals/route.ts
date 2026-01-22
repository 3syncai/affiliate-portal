import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

// GET /api/branch/referrals - Get referrals for a branch admin
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branchAdminCode = searchParams.get('referCode');

        if (!branchAdminCode) {
            return NextResponse.json({
                success: false,
                error: "Refer code parameter is required"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false
        });

        // Get branch admin referral stats
        const statsQuery = `
            SELECT 
                COUNT(*) as total_referrals,
                COALESCE(SUM(total_orders), 0) as total_orders,
                COALESCE(SUM(total_order_value), 0) as total_order_value,
                COALESCE(SUM(total_commission), 0) as total_commission
            FROM affiliate_referrals
            WHERE affiliate_code = $1
        `;

        const statsResult = await pool.query(statsQuery, [branchAdminCode]);
        const stats = statsResult.rows[0];

        // Get list of referrals with details
        const referralsQuery = `
            SELECT 
                ar.id,
                ar.customer_id,
                ar.customer_email,
                ar.customer_name,
                ar.total_orders,
                ar.total_order_value,
                ar.total_commission,
                ar.first_order_at,
                ar.referred_at as created_at
            FROM affiliate_referrals ar
            WHERE ar.affiliate_code = $1
            ORDER BY ar.referred_at DESC
            LIMIT 100
        `;

        const referralsResult = await pool.query(referralsQuery, [branchAdminCode]);

        // Get recent commission earnings from this branch admin's referrals
        const commissionsQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.product_name,
                acl.order_amount,
                acl.commission_amount,
                acl.affiliate_commission,
                acl.affiliate_rate,
                acl.customer_name,
                acl.status,
                acl.created_at
            FROM affiliate_commission_log acl
            WHERE acl.branch_admin_code = $1 AND acl.is_branch_admin_referral = TRUE
            ORDER BY acl.created_at DESC
            LIMIT 50
        `;

        const commissionsResult = await pool.query(commissionsQuery, [branchAdminCode]);

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                totalReferrals: parseInt(stats.total_referrals || '0'),
                totalOrders: parseInt(stats.total_orders || '0'),
                totalOrderValue: parseFloat(stats.total_order_value || '0'),
                totalCommission: parseFloat(stats.total_commission || '0')
            },
            referrals: referralsResult.rows,
            recentCommissions: commissionsResult.rows
        });

    } catch (error: any) {
        console.error("Failed to fetch branch referrals:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
