import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) {
            return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Get Commission Rate and Refer Code
        const adminDetailsRef = await pool.query(`
            SELECT ba.refer_code, cr.commission_percentage 
            FROM branch_admin ba 
            LEFT JOIN commission_rates cr ON cr.role_type = 'branch' 
            WHERE ba.id = $1
        `, [adminId]);

        let commissionRate = 15.0;
        let referCode = '';

        if (adminDetailsRef.rows.length > 0) {
            commissionRate = parseFloat(adminDetailsRef.rows[0].commission_percentage || '15.0');
            referCode = adminDetailsRef.rows[0].refer_code;
        }

        // 2. Statistics Query
        // We aggregate logs assigned to this admin (by ID or refer code)
        const statsQuery = `
            SELECT
                -- Override Commissions: Source 'branch_admin' AND Rate <= 50%
                COALESCE(SUM(CASE WHEN commission_source = 'branch_admin' AND affiliate_rate <= 50 THEN affiliate_commission ELSE 0 END), 0) as override_earnings,
                COUNT(CASE WHEN commission_source = 'branch_admin' AND affiliate_rate <= 50 THEN 1 END) as override_orders,
                
                -- Direct Commissions: Source != 'branch_admin' OR (Source = 'branch_admin' AND Rate > 50%)
                COALESCE(SUM(CASE WHEN commission_source != 'branch_admin' OR (commission_source = 'branch_admin' AND affiliate_rate > 50) THEN affiliate_commission ELSE 0 END), 0) as direct_earnings,
                COUNT(CASE WHEN commission_source != 'branch_admin' OR (commission_source = 'branch_admin' AND affiliate_rate > 50) THEN 1 END) as direct_orders
            FROM affiliate_commission_log
            WHERE (affiliate_user_id = $1 OR affiliate_code = $2) AND status = 'CREDITED'
        `;
        const statsRes = await pool.query(statsQuery, [adminId, referCode]);
        const statsData = statsRes.rows[0];

        const overrideEarnings = parseFloat(statsData.override_earnings);
        const directEarnings = parseFloat(statsData.direct_earnings);
        const overrideOrders = parseInt(statsData.override_orders);
        const directOrders = parseInt(statsData.direct_orders);

        const totalEarnings = overrideEarnings + directEarnings;
        const totalOrders = overrideOrders + directOrders;

        // 3. Paid Amount
        const paidQuery = `
            SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
            FROM admin_payments
            WHERE recipient_id = $1 AND recipient_type = 'branch' AND status = 'completed'
        `;
        const paidResult = await pool.query(paidQuery, [adminId]);
        const paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');

        const availableBalance = totalEarnings - paidAmount;

        // 4. Recent Orders
        const recentOrdersQuery = `
            SELECT 
                id,
                order_id,
                order_amount,
                commission_source,
                affiliate_commission as commission_amount, -- The amount YOU earned
                created_at,
                product_name,
                customer_name as first_name, -- Using customer name directly
                '' as last_name,
                affiliate_code as refer_code,
                affiliate_rate,
                CASE 
                    WHEN commission_source = 'branch_admin' AND affiliate_rate > 50 THEN 'Direct Sale'
                    WHEN commission_source = 'branch_admin' THEN 'Affiliate Override'
                    ELSE 'Direct Sale'
                END as type
            FROM affiliate_commission_log
            WHERE affiliate_user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `;
        const recentOrdersResult = await pool.query(recentOrdersQuery, [adminId]);

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                totalEarnings,
                overrideEarnings, // Affiliate Agent Commissions
                directEarnings,   // Direct Referral Commissions

                totalOrders,
                overrideOrders,   // Affiliate Orders
                directOrders,     // Direct Orders

                paidAmount,
                availableBalance,
                currentEarnings: availableBalance, // Alias

                commissionRate, // Override Rate
            },
            recentOrders: recentOrdersResult.rows
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch branch earnings:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
