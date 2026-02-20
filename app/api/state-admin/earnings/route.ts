import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId');

        if (!state || !adminId) {
            return NextResponse.json({ success: false, error: "State and Admin ID parameters are required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 0. Get State Admin Details (Refer Code)
        const adminCheck = await pool.query('SELECT refer_code FROM state_admin WHERE id = $1', [adminId]);
        const referCode = adminCheck.rows[0]?.refer_code;

        // 1. Get Commission Rate
        const rateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);
        const commissionRate = rateResult.rows.length > 0 ? parseFloat(rateResult.rows[0].commission_percentage) : 5.0;

        // 2. OVERRIDES: Calculate Commission metrics from others (Affiliate + Branch + ASM)
        // We gather the TOTAL Commission Amount generated in the state, then take 5% of it.

        // A. Regular Affiliates
        const affiliateQuery = `
            SELECT COALESCE(SUM(acl.commission_amount), 0) as total, COUNT(acl.id) as count
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1
        `;
        const affiliateRes = await pool.query(affiliateQuery, [state]);
        const baseForOverrides = parseFloat(affiliateRes.rows[0].total || '0');
        const countOverrides = parseInt(affiliateRes.rows[0].count || '0');

        // Note: Branch and ASM override logic would be similar (adding to baseForOverrides)
        // For simplicity adapting existing code logic:
        // FIX: Add check for affiliate_rate > 20 to ensure we only count DIRECT sales, not overrides (which look like duplicates here)
        const branchDirectQuery = `
            SELECT COALESCE(SUM(acl.commission_amount), 0) as total, COUNT(acl.id) as count
            FROM affiliate_commission_log acl
            JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            WHERE ba.state ILIKE $1 AND acl.commission_source = 'branch_admin' AND acl.affiliate_rate > 20
        `;
        const branchRes = await pool.query(branchDirectQuery, [state]);
        const baseForOverrides2 = parseFloat(branchRes.rows[0].total || '0') + baseForOverrides;
        const countOverrides2 = parseInt(branchRes.rows[0].count || '0') + countOverrides;

        const asmDirectQuery = `
            SELECT COALESCE(SUM(acl.commission_amount), 0) as total, COUNT(acl.id) as count
            FROM affiliate_commission_log acl
            JOIN area_sales_manager asm ON acl.affiliate_code = asm.refer_code
            WHERE asm.state ILIKE $1 AND acl.commission_source = 'asm_direct' AND acl.affiliate_rate > 20
        `;
        const asmRes = await pool.query(asmDirectQuery, [state]);
        const totalBaseForOverrides = parseFloat(asmRes.rows[0].total || '0') + baseForOverrides2;
        const totalOrdersOverrides = parseInt(asmRes.rows[0].count || '0') + countOverrides2;

        const earningsFromOverrides = totalBaseForOverrides * (commissionRate / 100);

        // 3. DIRECT SALES: 100% Commission
        let earningsFromDirect = 0;
        let countDirect = 0;

        if (referCode) {
            const directQuery = `
                SELECT COALESCE(SUM(acl.affiliate_commission), 0) as total, COUNT(acl.id) as count
                FROM affiliate_commission_log acl
                WHERE acl.affiliate_code = $1
            `;
            const directRes = await pool.query(directQuery, [referCode]);
            earningsFromDirect = parseFloat(directRes.rows[0].total || '0');
            countDirect = parseInt(directRes.rows[0].count || '0');
        }

        // 4. Totals
        const lifetimeEarnings = earningsFromOverrides + earningsFromDirect;
        const totalOrders = totalOrdersOverrides + countDirect;

        // 5. Paid Amount & Wallet
        // Assuming wallet balance is tracked or calculated as (Lifetime - Paid)
        let paidAmount = 0;
        const paidQuery = `
            SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
            FROM admin_payments
            WHERE recipient_id = $1 AND recipient_type = 'state' AND status = 'completed'
        `;
        const paidResult = await pool.query(paidQuery, [adminId]);
        paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');

        const currentEarnings = lifetimeEarnings - paidAmount;

        // 6. Recent Orders
        const recentOrdersQuery = `
            (
                SELECT acl.id, acl.order_id, acl.order_amount, acl.commission_amount, acl.created_at, acl.product_name,
                u.first_name, u.last_name, u.refer_code, s.city, s.branch_name as branch, 'Override' as type
                FROM affiliate_commission_log acl
                JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
                JOIN stores s ON u.branch ILIKE s.branch_name
                WHERE s.state ILIKE $1
            )
            UNION ALL
            (
                 SELECT acl.id, acl.order_id, acl.order_amount, acl.affiliate_commission as commission_amount, acl.created_at, acl.product_name, 
                 'You' as first_name, '' as last_name, acl.affiliate_code as refer_code, 'N/A' as city, 'N/A' as branch, 'Direct' as type
                 FROM affiliate_commission_log acl
                 WHERE acl.commission_source = 'state_admin_direct' AND acl.affiliate_code = $2
            )
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const recentOrdersResult = await pool.query(recentOrdersQuery, [state, referCode || 'INVALID']);


        return NextResponse.json({
            success: true,
            stats: {
                totalOrders,
                commissionRate,
                lifetimeEarnings,
                paidAmount,
                currentEarnings,
                // Breakdown for UI
                earningsFromOverrides,
                earningsFromDirect,
                ordersFromOverrides: totalOrdersOverrides,
                ordersFromDirect: countDirect
            },
            recentOrders: recentOrdersResult.rows
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch state admin earnings:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
