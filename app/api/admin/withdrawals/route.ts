import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// GET - Fetch all withdrawal requests
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // Optional filter

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        let query = `
      SELECT 
        id,
        affiliate_id,
        affiliate_code,
        affiliate_name,
        affiliate_email,
        withdrawal_amount,
        gst_percentage,
        gst_amount,
        net_payable,
        payment_method,
        bank_name,
        bank_branch,
        ifsc_code,
        account_name,
        account_number,
        upi_id,
        status,
        requested_at,
        reviewed_at,
        reviewed_by,
        admin_notes,
        wallet_balance_before
      FROM withdrawal_request
    `;

        const values: (string | number)[] = [];
        let valueIndex = 1;

        if (status) {
            query += ` WHERE status = $${valueIndex}`;
            values.push(status);
            valueIndex++;
        }

        query += ` ORDER BY requested_at DESC`;

        const result = await pool.query(query, values);

        return NextResponse.json({
            success: true,
            withdrawals: result.rows
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error fetching withdrawal requests:', err);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch withdrawal requests'
            },
            { status: 500 }
        );
    }
}

// POST - Approve or Reject withdrawal
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { withdrawalId, action, adminNotes } = body; // action: 'APPROVE' or 'REJECT'

        if (!withdrawalId || !action) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        if (action === 'APPROVE') {
            // Get withdrawal details
            const getWithdrawal = `
        SELECT withdrawal_amount, affiliate_id
        FROM withdrawal_request
        WHERE id = $1 AND status = 'PENDING'
      `;
            const withdrawalResult = await pool.query(getWithdrawal, [withdrawalId]);

            if (withdrawalResult.rows.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Withdrawal request not found or already processed' },
                    { status: 404 }
                );
            }

            const withdrawal = withdrawalResult.rows[0];

            // Deduct from wallet (withdrawal_amount includes GST deduction)
            const deductQuery = `
        UPDATE customer_wallet
        SET coins_balance = coins_balance - $1
        WHERE customer_id = $2 AND coins_balance >= $1
      `;
            const deductResult = await pool.query(deductQuery, [
                withdrawal.withdrawal_amount,
                withdrawal.affiliate_id
            ]);

            if (deductResult.rowCount === 0) {
                return NextResponse.json(
                    { success: false, error: 'Insufficient wallet balance' },
                    { status: 400 }
                );
            }

            // Update withdrawal status to APPROVED (admin will manually pay)
            const updateQuery = `
        UPDATE withdrawal_request
        SET 
          status = 'APPROVED',
          reviewed_at = CURRENT_TIMESTAMP,
          admin_notes = $1
        WHERE id = $2
      `;
            await pool.query(updateQuery, [adminNotes || 'Approved', withdrawalId]);

        } else if (action === 'REJECT') {
            // Just update status to REJECTED
            const updateQuery = `
        UPDATE withdrawal_request
        SET 
          status = 'REJECTED',
          reviewed_at = CURRENT_TIMESTAMP,
          admin_notes = $1
        WHERE id = $2 AND status = 'PENDING'
      `;
            await pool.query(updateQuery, [adminNotes || 'Rejected', withdrawalId]);
        }


        return NextResponse.json({
            success: true,
            message: `Withdrawal request ${action.toLowerCase()}ed successfully`
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error processing withdrawal:', err);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process withdrawal  request'
            },
            { status: 500 }
        );
    }
}
