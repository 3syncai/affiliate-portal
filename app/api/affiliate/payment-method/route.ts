import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
    console.log('=== Updating Payment Method ===');

    try {
        const body = await request.json();
        const { referCode, paymentMethod, bankDetails, upiDetails } = body;

        if (!referCode) {
            return NextResponse.json(
                { success: false, error: 'Affiliate code required' },
                { status: 400 }
            );
        }

        if (!paymentMethod || (paymentMethod !== 'Bank Transfer' && paymentMethod !== 'UPI')) {
            return NextResponse.json(
                { success: false, error: 'Valid payment method required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        let updateQuery = '';
        let updateValues: (string | null)[] = [];

        if (paymentMethod === 'Bank Transfer') {
            if (!bankDetails || !bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
                await pool.end();
                return NextResponse.json(
                    { success: false, error: 'Complete bank details required' },
                    { status: 400 }
                );
            }

            updateQuery = `
        UPDATE affiliate_user
        SET 
          payment_method = $1,
          bank_name = $2,
          bank_branch = $3,
          ifsc_code = $4,
          account_name = $5,
          account_number = $6,
          upi_id = NULL
        WHERE refer_code = $7
        RETURNING id
      `;
            updateValues = [
                'Bank Transfer',
                bankDetails.bankName || null,
                bankDetails.branch || null,
                bankDetails.ifscCode,
                bankDetails.accountName,
                bankDetails.accountNumber,
                referCode
            ];
        } else if (paymentMethod === 'UPI') {
            if (!upiDetails || !upiDetails.upiId) {
                await pool.end();
                return NextResponse.json(
                    { success: false, error: 'UPI ID required' },
                    { status: 400 }
                );
            }

            updateQuery = `
        UPDATE affiliate_user
        SET 
          payment_method = $1,
          upi_id = $2,
          bank_name = NULL,
          bank_branch = NULL,
          ifsc_code = NULL,
          account_name = NULL,
          account_number = NULL
        WHERE refer_code = $3
        RETURNING id
      `;
            updateValues = ['UPI', upiDetails.upiId, referCode];
        }

        const result = await pool.query(updateQuery, updateValues);

        if (result.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Affiliate not found' },
                { status: 404 }
            );
        }

        await pool.end();

        console.log('Payment method updated successfully');
        return NextResponse.json({
            success: true,
            message: 'Payment method updated successfully'
        });

    } catch (error) {
        console.error('Failed to update payment method:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update payment method',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
