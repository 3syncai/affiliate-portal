import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log('=== Fetching Wallet Data ===');

    try {
        // Get affiliate user ID from session/auth
        // For now, using refer_code from query params for testing
        const { searchParams } = new URL(request.url);
        const referCode = searchParams.get('refer_code');

        if (!referCode) {
            return NextResponse.json(
                { success: false, error: 'Affiliate code required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Fetch affiliate user with payment details
        const userQuery = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        refer_code,
        payment_method,
        bank_name,
        bank_branch,
        ifsc_code,
        account_name,
        account_number,
        upi_id
      FROM affiliate_user
      WHERE refer_code = $1
    `;
        const userResult = await pool.query(userQuery, [referCode]);

        if (userResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Affiliate not found' },
                { status: 404 }
            );
        }

        const user = userResult.rows[0];

        // Fetch total commission earned - ONLY CREDITED commissions (after delivery)
        // PENDING commissions are not counted until product is delivered
        const commissionQuery = `
      SELECT 
        COALESCE(SUM(COALESCE(affiliate_commission, affiliate_amount, commission_amount * 0.70)), 0) as total_earned
      FROM affiliate_commission_log
      WHERE affiliate_code = $1 AND status = 'CREDITED'
    `;
        const commissionResult = await pool.query(commissionQuery, [referCode]);
        const totalEarned = parseFloat(commissionResult.rows[0]?.total_earned) || 0;

        // Fetch total withdrawn (APPROVED + PAID withdrawals - money already deducted)
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

        // Calculate available balance dynamically (never gets out of sync!)
        // Available = Total Earned (70% of commissions) - Total Deducted (approved/paid withdrawals)
        const availableBalance = totalEarned - totalDeducted;

        await pool.end();

        // Format response
        const walletData = {
            user: {
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                referCode: user.refer_code
            },
            balance: {
                current: availableBalance,  // Calculated dynamically!
                totalEarned: totalEarned,
                withdrawn: totalPaidOut  // Only PAID withdrawals (actual money sent)
            },
            paymentMethod: user.payment_method ? {
                method: user.payment_method,
                bank: user.payment_method === 'Bank Transfer' ? {
                    name: user.bank_name,
                    branch: user.bank_branch,
                    ifscCode: user.ifsc_code,
                    accountName: user.account_name,
                    accountNumber: user.account_number
                } : null,
                upi: user.payment_method === 'UPI' ? {
                    id: user.upi_id
                } : null
            } : null
        };

        console.log('Wallet data fetched successfully');
        return NextResponse.json({
            success: true,
            data: walletData
        });

    } catch (error) {
        console.error('Failed to fetch wallet data:', error);
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
