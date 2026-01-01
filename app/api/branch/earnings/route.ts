import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');
        const adminId = searchParams.get('adminId'); // Branch admin's ID for payment tracking

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Get Commission Rate for Branch Admin (should be 3%)
        const rateResult = await pool.query(`
            SELECT commission_percentage 
            FROM commission_rates 
            WHERE role_type = 'branch'
        `);

        const commissionRate = rateResult.rows.length > 0
            ? parseFloat(rateResult.rows[0].commission_percentage)
            : 3.0; // Default to 3%

        // 2. Get Total AFFILIATE COMMISSIONS in this branch (use affiliate_amount column)
        const commissionsQuery = `
            SELECT 
                COALESCE(SUM(COALESCE(acl.affiliate_amount, acl.commission_amount * 0.70)), 0) as total_affiliate_commissions,
                COALESCE(SUM(acl.commission_amount), 0) as total_commission,
                COUNT(acl.id) as total_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.branch ILIKE $1
        `;

        const commissionsResult = await pool.query(commissionsQuery, [branch]);
        const totalAffiliateCommissions = parseFloat(commissionsResult.rows[0].total_affiliate_commissions || '0');
        const totalOrders = parseInt(commissionsResult.rows[0].total_orders || '0');

        // 3. Calculate Branch Admin Lifetime Earnings: X% of affiliate commissions
        const lifetimeEarnings = totalAffiliateCommissions * (commissionRate / 100);

        // 4. Get Total Paid Amount to this admin
        let paidAmount = 0;
        if (adminId) {
            const paidQuery = `
                SELECT COALESCE(SUM(amount), 0) as total_paid
                FROM admin_payments
                WHERE recipient_id = $1 AND recipient_type = 'branch' AND status = 'completed'
            `;
            const paidResult = await pool.query(paidQuery, [adminId]);
            paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');
        }

        // 5. Current Earnings = Lifetime - Paid
        const currentEarnings = lifetimeEarnings - paidAmount;

        // 6. Get Recent Orders for Transparency
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
                u.branch
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.branch ILIKE $1
            ORDER BY acl.created_at DESC
            LIMIT 50
        `;

        const recentOrdersResult = await pool.query(recentOrdersQuery, [branch]);

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                totalAffiliateCommissions,
                totalOrders,
                commissionRate,
                lifetimeEarnings,    // Total earned ever
                paidAmount,          // Amount already paid by admin
                currentEarnings,     // What's still owed (lifetime - paid)
                totalEarnings: currentEarnings // For backward compatibility
            },
            recentOrders: recentOrdersResult.rows
        });

    } catch (error: any) {
        console.error("Failed to fetch branch earnings:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
