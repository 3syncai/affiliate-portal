import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// GET - Fetch withdrawal history for an affiliate
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const referCode = searchParams.get('refer_code');

        if (!referCode) {
            return NextResponse.json(
                { success: false, error: 'Refer code is required' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        const query = `
      SELECT 
        id,
        withdrawal_amount,
        gst_percentage,
        gst_amount,
        net_payable,
        payment_method,
        status,
        requested_at,
        reviewed_at,
        transaction_id,
        payment_date,
        payment_details,
        admin_notes
      FROM withdrawal_request
      WHERE affiliate_code = $1
      ORDER BY requested_at DESC
    `;

        const result = await pool.query(query, [referCode]);
        await pool.end();

        return NextResponse.json({
            success: true,
            withdrawals: result.rows
        });

    } catch (error) {
        console.error('Error fetching withdrawal history:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch withdrawal history'
            },
            { status: 500 }
        );
    }
}
