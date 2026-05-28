import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const pool = new Pool({
            connectionString: getDatabaseUrl(),
            ssl: { rejectUnauthorized: false }
        });

        const query = `
            SELECT 
                id,
                recipient_id,
                recipient_type,
                recipient_name,
                recipient_email,
                amount,
                transaction_id,
                payment_method,
                account_details,
                paid_by,
                payment_date,
                notes,
                status,
                created_at
            FROM admin_payments
            ORDER BY payment_date DESC
            LIMIT 100
        `;

        const result = await pool.query(query);
        await pool.end();

        return NextResponse.json({
            success: true,
            payments: result.rows
        });

    } catch (error: any) {
        console.error("Failed to fetch payment history:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            recipientId,
            recipientType,
            recipientName,
            recipientEmail,
            amount,
            transactionId,
            paymentMethod,
            accountDetails,
            notes,
            tdsAmount,
            grossAmount
        } = body;

        // Validation
        if (!recipientId || !recipientType || !amount || !transactionId) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields"
            }, { status: 400 });
        }

        const numericAmount = parseFloat(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return NextResponse.json({
                success: false,
                error: "Amount must be a positive number"
            }, { status: 400 });
        }

        const method = paymentMethod || "Bank Transfer";
        const allowedMethods = ["Bank Transfer", "UPI", "Cheque", "Cash"];
        if (!allowedMethods.includes(method)) {
            return NextResponse.json({
                success: false,
                error: `Unsupported payment method: ${method}`
            }, { status: 400 });
        }

        // Per-method payout-detail validation. We also rebuild a sanitised
        // accountDetails object so Cheque/Cash submissions don't accidentally
        // persist stale bank metadata leaked through from the client form.
        const incoming = (accountDetails && typeof accountDetails === "object")
            ? accountDetails as Record<string, unknown>
            : {};
        let cleanAccountDetails: Record<string, unknown> = {};

        if (method === "Bank Transfer") {
            const accountNumber = typeof incoming.accountNumber === "string" ? incoming.accountNumber.trim() : "";
            const ifscCode = typeof incoming.ifscCode === "string" ? incoming.ifscCode.trim() : "";
            if (!accountNumber || !ifscCode) {
                return NextResponse.json({
                    success: false,
                    error: "Account number and IFSC code are required for Bank Transfer"
                }, { status: 400 });
            }
            cleanAccountDetails = {
                accountNumber,
                ifscCode,
                accountHolderName: incoming.accountHolderName ?? null,
                bankName: incoming.bankName ?? null,
                bankBranch: incoming.bankBranch ?? null,
            };
        } else if (method === "UPI") {
            const upiId = typeof incoming.upiId === "string" ? incoming.upiId.trim() : "";
            if (!upiId) {
                return NextResponse.json({
                    success: false,
                    error: "UPI ID is required for UPI payments"
                }, { status: 400 });
            }
            cleanAccountDetails = { upiId };
        }
        // Cheque / Cash carry no payout-account metadata.

        const pool = new Pool({
            connectionString: getDatabaseUrl(),
            ssl: { rejectUnauthorized: false }
        });

        // Insert payment record
        const insertQuery = `
            INSERT INTO admin_payments (
                recipient_id,
                recipient_type,
                recipient_name,
                recipient_email,
                amount,
                tds_amount,
                gross_amount,
                transaction_id,
                payment_method,
                account_details,
                paid_by,
                notes,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const accountDetailsJson = Object.keys(cleanAccountDetails).length > 0
            ? JSON.stringify(cleanAccountDetails)
            : null;

        // Ensure values are numbers/decimals
        const cleanTds = tdsAmount ? parseFloat(tdsAmount) : 0;
        const cleanGross = grossAmount ? parseFloat(grossAmount) : 0;

        const result = await pool.query(insertQuery, [
            recipientId,
            recipientType,
            recipientName,
            recipientEmail,
            numericAmount,
            cleanTds,
            cleanGross,
            transactionId,
            method,
            accountDetailsJson,
            'Main Admin',
            notes || null,
            'completed'
        ]);

        const payment = result.rows[0];

        // Send notification to recipient
        const notificationQuery = `
            INSERT INTO notifications (
                recipient_id,
                recipient_role,
                sender_id,
                sender_role,
                message,
                type,
                is_read
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const message = `Payment of ₹${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been credited to your account. Transaction ID: ${transactionId}`;

        await pool.query(notificationQuery, [
            recipientId,
            recipientType,
            'system',
            'admin',
            message,
            'payment',
            false
        ]);

        await pool.end();

        return NextResponse.json({
            success: true,
            payment,
            message: "Payment processed successfully and notification sent"
        });

    } catch (error: any) {
        console.error("Failed to process payment:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
