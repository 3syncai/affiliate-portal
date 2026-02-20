import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// Mark withdrawal as PAID with transaction details
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { withdrawalId, transactionId, paymentDate, paymentDetails } = body;

        if (!withdrawalId || !transactionId) {
            return NextResponse.json(
                { success: false, error: 'Transaction ID is required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Update withdrawal to PAID with transaction details
        const updateQuery = `
      UPDATE withdrawal_request
      SET 
        status = 'PAID',
        transaction_id = $1,
        payment_date = $2,
        payment_details = $3,
        paid_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND status = 'APPROVED'
      RETURNING id
    `;

        const result = await pool.query(updateQuery, [
            transactionId,
            paymentDate || new Date(),
            paymentDetails || '',
            withdrawalId
        ]);


        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Withdrawal not found or not in APPROVED status' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Payment marked as completed successfully'
        });

    } catch (error) {
        console.error('Error marking payment as paid:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to mark payment as paid'
            },
            { status: 500 }
        );
    }
}
