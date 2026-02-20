import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// DELETE /api/admin/payments/delete
// Deletes payment records by IDs
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { paymentIds } = body;

        if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: "paymentIds array is required"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Delete payment records
        const deleteQuery = `
            DELETE FROM admin_payments 
            WHERE id = ANY($1::uuid[])
            RETURNING id, recipient_name, amount
        `;

        const result = await pool.query(deleteQuery, [paymentIds]);


        return NextResponse.json({
            success: true,
            message: `Deleted ${result.rowCount} payment records`,
            deleted: result.rows
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to delete payments:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
