import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
const normalize = (value: unknown) => String(value ?? '').trim();

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
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const affiliateResult = await pool.query(
            `SELECT 
                id, first_name, last_name, city, state, branch, payment_method, 
                bank_name, bank_branch, ifsc_code, account_name, account_number
             FROM affiliate_user
             WHERE refer_code = $1`,
            [referCode]
        );

        if (affiliateResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, error: 'Affiliate not found' },
                { status: 404 }
            );
        }

        const existingAffiliate = affiliateResult.rows[0];

        let updateQuery = '';
        let updateValues: any[] = [];
        let bankDetailsChanged = false;

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

            bankDetailsChanged =
                normalize(existingAffiliate.payment_method) !== 'Bank Transfer' ||
                normalize(existingAffiliate.bank_name) !== normalize(bankDetails.bankName) ||
                normalize(existingAffiliate.bank_branch) !== normalize(bankDetails.branch) ||
                normalize(existingAffiliate.ifsc_code).toUpperCase() !== normalize(bankDetails.ifscCode).toUpperCase() ||
                normalize(existingAffiliate.account_name) !== normalize(bankDetails.accountName) ||
                normalize(existingAffiliate.account_number) !== normalize(bankDetails.accountNumber);
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

        // Always notify branch dashboard users when bank details are saved.
        // This avoids missing alerts due to strict change detection edge cases.
        if (paymentMethod === 'Bank Transfer') {
            try {
                const branchRecipients = await pool.query(
                    `SELECT DISTINCT ba.id::text AS recipient_id
                     FROM branch_admin ba
                     WHERE ba.is_active = true
                       AND (
                         LOWER(TRIM(COALESCE(ba.branch, ''))) = LOWER(TRIM(COALESCE($1, '')))
                         OR (
                           LOWER(TRIM(COALESCE(ba.city, ''))) = LOWER(TRIM(COALESCE($2, '')))
                           AND LOWER(TRIM(COALESCE(ba.state, ''))) = LOWER(TRIM(COALESCE($3, '')))
                         )
                         OR LOWER(TRIM(COALESCE(ba.state, ''))) = LOWER(TRIM(COALESCE($3, '')))
                       )`,
                    [
                        existingAffiliate.branch || '',
                        existingAffiliate.city || '',
                        existingAffiliate.state || ''
                    ]
                );

                let recipients = branchRecipients.rows;

                // Final fallback: notify all active branch admins so the update is never missed.
                if (recipients.length === 0) {
                    const fallbackRecipients = await pool.query(
                        `SELECT DISTINCT ba.id::text AS recipient_id
                         FROM branch_admin ba
                         WHERE ba.is_active = true`
                    );
                    recipients = fallbackRecipients.rows;
                }

                if (recipients.length > 0) {
                    const affiliateName = `${existingAffiliate.first_name || ''} ${existingAffiliate.last_name || ''}`.trim() || referCode;
                    const regionLabel = [existingAffiliate.branch, existingAffiliate.city, existingAffiliate.state]
                        .filter(Boolean)
                        .join(", ");
                    const notificationMessage = `${affiliateName} affiliate in your region${regionLabel ? ` (${regionLabel})` : ''} has updated its bank details.`;

                    await Promise.all(
                        recipients.map((recipient: { recipient_id: string }) =>
                            pool.query(
                                `INSERT INTO notifications (
                                    recipient_id,
                                    recipient_role,
                                    sender_id,
                                    sender_role,
                                    message,
                                    type,
                                    is_read
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                [
                                    recipient.recipient_id,
                                    'branch',
                                    existingAffiliate.id,
                                    'affiliate',
                                    notificationMessage,
                                    'alert',
                                    false
                                ]
                            )
                        )
                    );
                } else {
                    console.log(`No Branch recipients found for bank update notification (referCode: ${referCode})`);
                }
            } catch (notifyError) {
                // Don't fail bank update if notification insertion has an issue.
                console.error('Failed to notify Branch for bank update:', notifyError);
            }
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
