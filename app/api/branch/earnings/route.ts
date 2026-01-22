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
            : 5.0; // Default to 5%

        // 2. Get Branch Admin's DIRECT REFERRALS (where they referred customers themselves - 75% commission)
        const directReferralsQuery = `
            SELECT 
                COALESCE(SUM(acl.affiliate_commission), 0) as direct_earnings,
                COUNT(acl.id) as direct_orders
            FROM affiliate_commission_log acl
            JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            WHERE ba.branch ILIKE $1 AND acl.is_branch_admin_referral = TRUE
        `;

        const directResult = await pool.query(directReferralsQuery, [branch]);
        const directEarnings = parseFloat(directResult.rows[0].direct_earnings || '0');
        const directOrders = parseInt(directResult.rows[0].direct_orders || '0');

        // 3. Get Total AFFILIATE COMMISSIONS in this branch (for team management - 5% of affiliate earnings)
        const commissionsQuery = `
            SELECT 
                COALESCE(SUM(COALESCE(acl.affiliate_commission, acl.commission_amount * 0.70)), 0) as total_affiliate_commissions,
                COALESCE(SUM(acl.commission_amount), 0) as total_commission,
                COUNT(acl.id) as total_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.branch ILIKE $1 AND (acl.is_branch_admin_referral = FALSE OR acl.is_branch_admin_referral IS NULL)
        `;

        const commissionsResult = await pool.query(commissionsQuery, [branch]);
        const totalAffiliateCommissions = parseFloat(commissionsResult.rows[0].total_affiliate_commissions || '0');
        const teamOrders = parseInt(commissionsResult.rows[0].total_orders || '0');

        // 4. Calculate Branch Admin Earnings from Team Management: X% of affiliate commissions
        const teamManagementEarnings = totalAffiliateCommissions * (commissionRate / 100);

        // 5. Total Lifetime Earnings = Direct Referrals + Team Management
        const lifetimeEarnings = directEarnings + teamManagementEarnings;
        const totalOrders = directOrders + teamOrders;

        // 6. Get Total Paid Amount to this admin
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

        // 7. Current Earnings = Lifetime - Paid
        const currentEarnings = lifetimeEarnings - paidAmount;

        // 8. Get Recent Orders for Transparency (both types)
        const recentOrdersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.order_amount,
                acl.commission_amount,
                acl.affiliate_commission,
                acl.is_branch_admin_referral,
                acl.created_at,
                acl.product_name,
                COALESCE(u.first_name, ba.first_name) as first_name,
                COALESCE(u.last_name, ba.last_name) as last_name,
                acl.affiliate_code as refer_code,
                COALESCE(u.branch, ba.branch) as branch
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            LEFT JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            WHERE (u.branch ILIKE $1 OR ba.branch ILIKE $1)
            ORDER BY acl.created_at DESC
            LIMIT 50
        `;

        const recentOrdersResult = await pool.query(recentOrdersQuery, [branch]);

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                // Direct referrals (branch admin referring customers)
                directEarnings,
                directOrders,
                // Team management (earning % from affiliates)
                teamManagementEarnings,
                teamOrders,
                totalAffiliateCommissions,
                // Combined totals
                totalOrders,
                commissionRate,
                lifetimeEarnings,    // Total earned ever (direct + team management)
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
