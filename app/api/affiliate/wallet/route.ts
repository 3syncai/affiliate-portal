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

        // Fetch wallet balance
        const walletQuery = `
      SELECT coins_balance
      FROM customer_wallet
      WHERE customer_id = $1
    `;
        const walletResult = await pool.query(walletQuery, [user.id]);
        const walletBalance = walletResult.rows[0]?.coins_balance || 0;

        // Fetch total commission earned
        const commissionQuery = `
      SELECT COALESCE(SUM(commission_amount), 0) as total_earned
      FROM affiliate_commission_log
      WHERE affiliate_code = $1
    `;
        const commissionResult = await pool.query(commissionQuery, [referCode]);
        const totalEarned = parseFloat(commissionResult.rows[0]?.total_earned) || 0;

        // Fetch total withdrawn (only PAID withdrawals)
        const withdrawnQuery = `
      SELECT COALESCE(SUM(net_payable), 0) as total_withdrawn
      FROM withdrawal_request
      WHERE affiliate_code = $1 AND status = 'PAID'
    `;
        const withdrawnResult = await pool.query(withdrawnQuery, [referCode]);
        const totalWithdrawn = parseFloat(withdrawnResult.rows[0]?.total_withdrawn) || 0;

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
                current: parseFloat(walletBalance) || 0,
                totalEarned: totalEarned,
                withdrawn: totalWithdrawn  // Only PAID withdrawals
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
