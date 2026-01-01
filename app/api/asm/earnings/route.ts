import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId'); // ASM's ID for payment tracking

        if (!city || !state) {
            return NextResponse.json({ success: false, error: "City and State parameters are required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Get Commission Rate for ASM (should be 2%)
        const rateResult = await pool.query(`
            SELECT commission_percentage 
            FROM commission_rates 
            WHERE role_type = 'area'
        `);

        const commissionRate = rateResult.rows.length > 0
            ? parseFloat(rateResult.rows[0].commission_percentage)
            : 2.0; // Default to 2%

        // 2. Calculate total AFFILIATE COMMISSIONS in this city/state
        const commissionsQuery = `
            SELECT 
                COALESCE(SUM(acl.commission_amount), 0) as total_affiliate_commissions
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
        `;

        const commissionsResult = await pool.query(commissionsQuery, [city, state]);
        const totalAffiliateCommissions = parseFloat(commissionsResult.rows[0].total_affiliate_commissions || '0');

        // 3. Calculate ASM Lifetime Earnings: ASM rate % of affiliate commissions
        const lifetimeEarnings = totalAffiliateCommissions * (commissionRate / 100);

        // 4. Get Total Paid Amount to this admin
        let paidAmount = 0;
        if (adminId) {
            const paidQuery = `
                SELECT COALESCE(SUM(amount), 0) as total_paid
                FROM admin_payments
                WHERE recipient_id = $1 AND recipient_type = 'asm' AND status = 'completed'
            `;
            const paidResult = await pool.query(paidQuery, [adminId]);
            paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');
        }

        // 5. Current Earnings = Lifetime - Paid
        const currentEarnings = lifetimeEarnings - paidAmount;

        // 6. Get count of orders in the area
        const ordersCountQuery = `
            SELECT COUNT(acl.id) as total_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
        `;

        const ordersResult = await pool.query(ordersCountQuery, [city, state]);
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
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
            ORDER BY acl.created_at DESC
            LIMIT 50
        `;

        const recentOrdersResult = await pool.query(recentOrdersQuery, [city, state]);

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
        console.error("Failed to fetch ASM earnings:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
