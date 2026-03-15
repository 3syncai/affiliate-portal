import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Branch Admin Marking Withdrawal as Paid ===");

    try {
        const body = await req.json();
        const { withdrawalId, transactionId, paymentDate, paymentDetails } = body;

        if (!withdrawalId || !transactionId) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get withdrawal details for logging
        const withdrawalResult = await pool.query(
            `SELECT wr.*, au.first_name, au.last_name, au.branch, au.state
             FROM withdrawal_request wr
             JOIN affiliate_user au ON au.id = wr.affiliate_id
             WHERE wr.id = $1`,
            [withdrawalId]
        );

        await pool.query(
            `UPDATE withdrawal_request 
             SET status = 'PAID', transaction_id = $1, payment_date = $2, payment_details = $3, paid_at = NOW() 
             WHERE id = $4`,
            [transactionId, paymentDate, paymentDetails || '', withdrawalId]
        );

        // Log activity for all admins to see
        if (withdrawalResult.rows.length > 0) {
            const withdrawal = withdrawalResult.rows[0];
            try {
                await pool.query(
                    `INSERT INTO activity_log 
                     (activity_type, actor_name, actor_role, actor_branch, actor_state, 
                      target_name, target_type, amount, description, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        'payment_paid',
                        withdrawal.branch + ' Admin',
                        'branch',
                        withdrawal.branch,
                        withdrawal.state,
                        `${withdrawal.first_name} ${withdrawal.last_name}`,
                        'withdrawal',
                        withdrawal.net_payable,
                        `${withdrawal.branch} branch paid ₹${parseFloat(withdrawal.net_payable).toFixed(2)} to ${withdrawal.first_name} ${withdrawal.last_name}`,
                        JSON.stringify({ transactionId, paymentDate })
                    ]
                );
            } catch (e) {
                console.log("Activity log insert failed:", e);
            }
        }

        await pool.end();

        return NextResponse.json({ success: true, message: "Marked as paid" });
    } catch (error: any) {
        console.error("Failed to mark as paid:", error);
        return NextResponse.json({ success: false, message: "Failed to mark as paid" }, { status: 500 });
    }
}
