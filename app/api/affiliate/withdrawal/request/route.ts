import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    console.log('=== Submitting Withdrawal Request ===');

    try {
        const body = await request.json();
        const {
            referCode,
            withdrawalAmount,
            gstPercentage,
            gstAmount,
            netPayable,
            paymentMethod,
            bankDetails,
            upiDetails,
            walletBalance
        } = body;

        // Validation
        if (!referCode || !withdrawalAmount || withdrawalAmount < 20) {
            return NextResponse.json(
                { success: false, error: 'Invalid withdrawal amount. Minimum ₹20' },
                { status: 400 }
            );
        }

        if (withdrawalAmount > walletBalance) {
            return NextResponse.json(
                { success: false, error: 'Insufficient wallet balance' },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Create table if not exists
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS withdrawal_request (
        id SERIAL PRIMARY KEY,
        affiliate_id TEXT NOT NULL,
        affiliate_code VARCHAR(255) NOT NULL,
        affiliate_name VARCHAR(255) NOT NULL,
        affiliate_email VARCHAR(255) NOT NULL,
        withdrawal_amount DECIMAL(10, 2) NOT NULL,
        gst_percentage DECIMAL(5, 2) NOT NULL,
        gst_amount DECIMAL(10, 2) NOT NULL,
        net_payable DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        bank_name VARCHAR(255),
        bank_branch VARCHAR(255),
        ifsc_code VARCHAR(50),
        account_name VARCHAR(255),
        account_number VARCHAR(100),
        upi_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'PENDING',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by VARCHAR(255),
        admin_notes TEXT,
        wallet_balance_before DECIMAL(10, 2)
      )
    `;
        await pool.query(createTableQuery);

        // Get affiliate details
        const affiliateQuery = `
      SELECT id, first_name, last_name, email
      FROM affiliate_user
      WHERE refer_code = $1
    `;
        const affiliateResult = await pool.query(affiliateQuery, [referCode]);

        if (affiliateResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Affiliate not found' },
                { status: 404 }
            );
        }

        const affiliate = affiliateResult.rows[0];

        // Check for existing pending request
        const pendingCheck = `
      SELECT id FROM withdrawal_request
      WHERE affiliate_id = $1 AND status = 'PENDING'
    `;
        const pendingResult = await pool.query(pendingCheck, [affiliate.id]);

        if (pendingResult.rows.length > 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'You already have a pending withdrawal request' },
                { status: 400 }
            );
        }

        // Log payment details for debugging
        console.log('Payment method:', paymentMethod);
        console.log('Bank details:', bankDetails);
        console.log('UPI details:', upiDetails);

        // Insert withdrawal request
        const insertQuery = `
      INSERT INTO withdrawal_request (
        affiliate_id, affiliate_code, affiliate_name, affiliate_email,
        withdrawal_amount, gst_percentage, gst_amount, net_payable,
        payment_method, bank_name, bank_branch, ifsc_code, account_name, account_number, upi_id,
        wallet_balance_before
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;

        const values = [
            affiliate.id,
            referCode,
            `${affiliate.first_name} ${affiliate.last_name}`,
            affiliate.email,
            withdrawalAmount,
            gstPercentage,
            gstAmount,
            netPayable,
            paymentMethod,
            paymentMethod === 'Bank Transfer' ? bankDetails?.bankName : null,
            paymentMethod === 'Bank Transfer' ? bankDetails?.branch : null,
            paymentMethod === 'Bank Transfer' ? bankDetails?.ifscCode : null,
            paymentMethod === 'Bank Transfer' ? bankDetails?.accountName : null,
            paymentMethod === 'Bank Transfer' ? bankDetails?.accountNumber : null,
            paymentMethod === 'UPI' ? upiDetails?.id : null,  // Fixed: use 'id' instead of 'upiId'
            walletBalance
        ];

        console.log('Inserting UPI ID:', paymentMethod === 'UPI' ? upiDetails?.id : null);

        const result = await pool.query(insertQuery, values);
        await pool.end();

        console.log('Withdrawal request created:', result.rows[0].id);

        return NextResponse.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            requestId: result.rows[0].id
        });

    } catch (error) {
        console.error('Error submitting withdrawal request:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to submit withdrawal request',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
