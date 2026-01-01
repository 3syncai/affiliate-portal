import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId'); // State admin's ID for payment tracking

        if (!state) {
            return NextResponse.json({ success: false, error: "State parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Get Commission Rate for State Admin (should be 1%)
        const rateResult = await pool.query(`
            SELECT commission_percentage 
            FROM commission_rates 
            WHERE role_type = 'state'
        `);

        const commissionRate = rateResult.rows.length > 0
            ? parseFloat(rateResult.rows[0].commission_percentage)
            : 1.0; // Default to 1%

        // 2. Calculate total AFFILIATE COMMISSIONS in this state
        const commissionsQuery = `
            SELECT 
                COALESCE(SUM(acl.commission_amount), 0) as total_affiliate_commissions
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1
        `;

        const commissionsResult = await pool.query(commissionsQuery, [state]);
        const totalAffiliateCommissions = parseFloat(commissionsResult.rows[0].total_affiliate_commissions || '0');

        // 3. Calculate State Admin Lifetime Earnings: State rate % of affiliate commissions
        const lifetimeEarnings = totalAffiliateCommissions * (commissionRate / 100);

        // 4. Get Total Paid Amount to this admin
        let paidAmount = 0;
        if (adminId) {
            const paidQuery = `
                SELECT COALESCE(SUM(amount), 0) as total_paid
                FROM admin_payments
                WHERE recipient_id = $1 AND recipient_type = 'state' AND status = 'completed'
            `;
            const paidResult = await pool.query(paidQuery, [adminId]);
            paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');
        }

        // 5. Current Earnings = Lifetime - Paid
        const currentEarnings = lifetimeEarnings - paidAmount;

        // 6. Get count of orders in the state
        const ordersCountQuery = `
            SELECT COUNT(acl.id) as total_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1
        `;

        const ordersResult = await pool.query(ordersCountQuery, [state]);
        const totalOrders = parseInt(ordersResult.rows[0].total_orders || '0');

        // 7. Get Recent Orders for Transparency
        const recentOrdersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.order_amount,
                acl.commission_amount,
                acl.created_at,
                acl.product_name,
                u.first_name,
                u.last_name,
                u.refer_code,
                s.city,
                u.branch
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1
            ORDER BY acl.created_at DESC
            LIMIT 50
        `;

        const recentOrdersResult = await pool.query(recentOrdersQuery, [state]);

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                totalAffiliateCommissions,
                totalOrders,
                commissionRate,
                lifetimeEarnings,
                paidAmount,
                currentEarnings,
                totalEarnings: currentEarnings // For backward compatibility
            },
            recentOrders: recentOrdersResult.rows
        });

    } catch (error: any) {
        console.error("Failed to fetch State Admin earnings:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
