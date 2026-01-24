import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branch/wallet?refer_code=OWEGBR12345
 * 
 * Branch admin wallet endpoint - tracks earnings from direct referrals
 * Similar to affiliate wallet but filters for branch_admin commission_source
 */
export async function GET(request: Request) {
    console.log('=== Fetching Branch Admin Wallet Data ===');

    try {
        const { searchParams } = new URL(request.url);
        const referCode = searchParams.get('refer_code');

        if (!referCode) {
            return NextResponse.json(
                { success: false, error: 'Branch admin referral code required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Fetch branch admin with payment details
        const userQuery = `
            SELECT 
                id,
                first_name,
                last_name,
                email,
                refer_code,
                branch,
                city,
                state,
                phone
            FROM branch_admin
            WHERE refer_code = $1
        `;
        const userResult = await pool.query(userQuery, [referCode]);

        if (userResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Branch admin not found' },
                { status: 404 }
            );
        }

        const user = userResult.rows[0];

        // Fetch total commission earned from DIRECT referrals (commission_source = 'branch_admin')
        // Uses affiliate_commission column which stores the actual amount (85% for branch admins)
        const commissionQuery = `
            SELECT 
                COALESCE(SUM(COALESCE(affiliate_commission, commission_amount * 0.85)), 0) as total_earned
            FROM affiliate_commission_log
            WHERE affiliate_code = $1 AND commission_source = 'branch_admin'
        `;
        const commissionResult = await pool.query(commissionQuery, [referCode]);
        const totalEarned = parseFloat(commissionResult.rows[0]?.total_earned) || 0;

        // Fetch total withdrawn (APPROVED + PAID withdrawals from branch admin)
        const withdrawnQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN net_payable ELSE 0 END), 0) as paid_out,
                COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'PAID') THEN withdrawal_amount ELSE 0 END), 0) as total_deducted
            FROM withdrawal_request
            WHERE affiliate_code = $1
        `;
        const withdrawnResult = await pool.query(withdrawnQuery, [referCode]);
        const totalPaidOut = parseFloat(withdrawnResult.rows[0]?.paid_out) || 0;
        const totalDeducted = parseFloat(withdrawnResult.rows[0]?.total_deducted) || 0;

        // Calculate available balance (same logic as affiliate wallet)
        const availableBalance = totalEarned - totalDeducted;

        await pool.end();

        // Format response
        const walletData = {
            user: {
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                referCode: user.refer_code,
                branch: user.branch,
                city: user.city,
                state: user.state,
                phone: user.phone,
                role: 'branch_admin'
            },
            balance: {
                current: availableBalance,  // Calculated dynamically
                totalEarned: totalEarned,   // From direct referrals only
                withdrawn: totalPaidOut     // Only PAID withdrawals
            }
        };

        console.log('Branch admin wallet data fetched successfully');
        console.log(`Earnings: ₹${totalEarned}, Withdrawn: ₹${totalPaidOut}, Available: ₹${availableBalance}`);

        return NextResponse.json({
            success: true,
            data: walletData
        });

    } catch (error) {
        console.error('Failed to fetch branch admin wallet data:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch wallet data',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
