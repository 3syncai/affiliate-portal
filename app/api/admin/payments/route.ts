import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
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
            notes
        } = body;

        // Validation
        if (!recipientId || !recipientType || !amount || !transactionId) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
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
                transaction_id,
                payment_method,
                account_details,
                paid_by,
                notes,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const accountDetailsJson = accountDetails ? JSON.stringify(accountDetails) : null;

        const result = await pool.query(insertQuery, [
            recipientId,
            recipientType,
            recipientName,
            recipientEmail,
            amount,
            transactionId,
            paymentMethod || 'Bank Transfer',
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

        const message = `Payment of ₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been credited to your account. Transaction ID: ${transactionId}`;

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
