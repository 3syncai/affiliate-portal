import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    console.log('=== Fetching Affiliate Stats ===');

    try {
        // Get affiliate code from headers
        const affiliateCode = request.headers.get('x-affiliate-code');

        if (!affiliateCode) {
            return NextResponse.json(
                { success: false, error: 'Affiliate code required' },
                { status: 400 }
            );
        }

        // Get affiliate user
        const userResult = await pool.query(
            'SELECT id, refer_code FROM affiliate_user WHERE refer_code = $1',
            [affiliateCode]
        );

        if (userResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Affiliate not found' },
                { status: 404 }
            );
        }

        const affiliateUser = userResult.rows[0];

        // 1. Get referral stats from affiliate_referrals table
        const referralsQuery = `
            SELECT 
                COUNT(DISTINCT customer_id) as total
            FROM affiliate_referrals
            WHERE affiliate_code = $1
        `;
        const referralsResult = await pool.query(referralsQuery, [affiliateCode]);

        // Count active customers (those who have placed orders)
        const activeCustomersQuery = `
            SELECT COUNT(DISTINCT ar.customer_id) as active
            FROM affiliate_referrals ar
            INNER JOIN affiliate_commission_log acl ON acl.customer_id = ar.customer_id
            WHERE ar.affiliate_code = $1
        `;
        const activeResult = await pool.query(activeCustomersQuery, [affiliateCode]);

        // Get order counts and values from commission log
        const ordersQuery = `
            SELECT 
                COUNT(DISTINCT order_id) as total_orders,
                COALESCE(SUM(order_amount), 0) as total_order_value
            FROM affiliate_commission_log
            WHERE affiliate_code = $1
        `;
        const ordersResult = await pool.query(ordersQuery, [affiliateCode]);

        const referrals = {
            total: parseInt(referralsResult.rows[0]?.total || '0'),
            active: parseInt(activeResult.rows[0]?.active || '0'),
            total_orders: parseInt(ordersResult.rows[0]?.total_orders || '0'),
            total_order_value: parseFloat(ordersResult.rows[0]?.total_order_value || '0')
        };

        // 2. Get commission stats (use STORED affiliate_commission to preserve historical rates)
        const commissionQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN COALESCE(affiliate_commission, commission_amount * 0.70) ELSE 0 END), 0) as total_earned,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN COALESCE(affiliate_commission, commission_amount * 0.70) ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN COALESCE(affiliate_commission, commission_amount * 0.70) ELSE 0 END), 0) as credited
            FROM affiliate_commission_log
            WHERE affiliate_code = $1
        `;
        const commissionResult = await pool.query(commissionQuery, [affiliateCode]);

        const commission = {
            total_earned: parseFloat(commissionResult.rows[0]?.total_earned || '0'),
            pending: parseFloat(commissionResult.rows[0]?.pending || '0'),
            credited: parseFloat(commissionResult.rows[0]?.credited || '0')
        };

        // 3. Get wallet balance (use stored affiliate_commission)
        const walletQuery = `
            SELECT 
                COALESCE(SUM(COALESCE(affiliate_commission, commission_amount * 0.70)), 0) as total_earned
            FROM affiliate_commission_log
            WHERE affiliate_code = $1 AND status = 'CREDITED'
        `;
        const walletResult = await pool.query(walletQuery, [affiliateCode]);
        const totalEarned = parseFloat(walletResult.rows[0]?.total_earned || '0');

        const withdrawnQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'PAID') THEN withdrawal_amount ELSE 0 END), 0) as total_deducted
            FROM withdrawal_request
            WHERE affiliate_code = $1
        `;
        const withdrawnResult = await pool.query(withdrawnQuery, [affiliateCode]);
        const totalDeducted = parseFloat(withdrawnResult.rows[0]?.total_deducted || '0');

        const wallet = {
            balance: totalEarned - totalDeducted,
            locked: 0 // Can be calculated based on pending withdrawals if needed
        };

        // 4. Get recent referrals from affiliate_referrals table with customer details
        const recentReferralsQuery = `
            SELECT 
                ar.customer_id as id,
                COALESCE(ar.customer_email, ar.customer_id) as customer_email,
                COALESCE(ar.customer_name, 'Customer ' || SUBSTRING(ar.customer_id FROM 5 FOR 8)) as customer_name,
                ar.referred_at,
                COUNT(DISTINCT acl.order_id) as order_count,
                COALESCE(SUM(COALESCE(acl.affiliate_commission, acl.commission_amount * 0.70)), 0) as total_earned
            FROM affiliate_referrals ar
            LEFT JOIN affiliate_commission_log acl ON acl.customer_id = ar.customer_id AND acl.affiliate_code = ar.affiliate_code
            WHERE ar.affiliate_code = $1
            GROUP BY ar.customer_id, ar.customer_email, ar.customer_name, ar.referred_at
            ORDER BY ar.referred_at DESC
            LIMIT 10
        `;
        const recentReferralsResult = await pool.query(recentReferralsQuery, [affiliateCode]);

        const recent_referrals = recentReferralsResult.rows.map(row => ({
            id: row.id,
            customer_email: row.customer_email,
            customer_name: row.customer_name,
            referred_at: row.referred_at,
            first_order_at: row.referred_at,
            total_orders: parseInt(row.order_count || '0'),
            total_commission: parseFloat(row.total_earned || '0')
        }));

        // 5. Get recent commissions (last 10) - Return affiliate_commission (historical rates)
        const recentCommissionsQuery = `
            SELECT 
                id,
                order_id,
                product_name,
                order_amount,
                commission_rate,
                commission_amount,
                COALESCE(affiliate_commission, commission_amount * 0.70) as affiliate_commission,
                commission_source,
                status,
                created_at
            FROM affiliate_commission_log
            WHERE affiliate_code = $1
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const recentCommissionsResult = await pool.query(recentCommissionsQuery, [affiliateCode]);

        const recent_commissions = recentCommissionsResult.rows.map(row => ({
            id: row.id,
            order_id: row.order_id,
            product_name: row.product_name,
            order_amount: parseFloat(row.order_amount || '0'),
            commission_rate: parseFloat(row.commission_rate || '0'),
            commission_amount: parseFloat(row.affiliate_commission || '0'), // Use stored affiliate_commission
            commission_source: row.commission_source,
            status: row.status,
            created_at: row.created_at
        }));



        const stats = {
            referrals,
            commission,
            wallet,
            recent_referrals,
            recent_commissions
        };

        console.log('Stats fetched successfully:', stats);
        return NextResponse.json(stats);

    } catch (error) {
        console.error('Failed to fetch affiliate stats:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch stats',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
