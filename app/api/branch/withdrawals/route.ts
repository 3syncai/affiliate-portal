import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Withdrawals ===");

    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');
        const status = searchParams.get('status');

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        let query = `
            SELECT 
                wr.id,
                au.first_name || ' ' || au.last_name as affiliate_name,
                au.email as affiliate_email,
                au.refer_code as affiliate_code,
                au.branch as affiliate_branch,
                wr.withdrawal_amount,
                wr.gst_percentage,
                wr.gst_amount,
                wr.net_payable,
                wr.payment_method,
                wr.bank_name,
                wr.ifsc_code,
                wr.account_name,
                wr.account_number,
                wr.upi_id,
                wr.status,
                wr.requested_at,
                wr.transaction_id,
                wr.payment_date,
                wr.payment_details
            FROM withdrawal_request wr
            INNER JOIN affiliate_user au ON au.id = wr.affiliate_id
            WHERE au.branch ILIKE $1
        `;

        const params: any[] = [branch];

        if (status && status !== 'ALL') {
            query += ` AND wr.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY wr.requested_at DESC`;

        const result = await pool.query(query, params);
        await pool.end();

        console.log(`Found ${result.rows.length} withdrawals for branch: ${branch}`);

        return NextResponse.json({
            success: true,
            withdrawals: result.rows
        });
    } catch (error: any) {
        console.error("Failed to fetch branch withdrawals:", error);
        return NextResponse.json({ success: true, withdrawals: [] });
    }
}

export async function POST(req: NextRequest) {
    console.log("=== Branch Admin Processing Withdrawal ===");

    try {
        const body = await req.json();
        const { withdrawalId, action, adminNotes } = body;

        if (!withdrawalId || !action) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        if (action === 'APPROVE') {
            // Get withdrawal details with affiliate info including city (area)
            const withdrawalResult = await pool.query(
                `SELECT wr.*, au.first_name, au.last_name, au.branch, au.city, au.state
                 FROM withdrawal_request wr
                 JOIN affiliate_user au ON au.id = wr.affiliate_id
                 WHERE wr.id = $1`,
                [withdrawalId]
            );

            if (withdrawalResult.rows.length === 0) {
                await pool.end();
                return NextResponse.json({ success: false, message: "Withdrawal not found" }, { status: 404 });
            }

            const withdrawal = withdrawalResult.rows[0];

            // Deduct from wallet (customer_wallet uses customer_id column)
            await pool.query(
                `UPDATE customer_wallet SET coins_balance = coins_balance - $1 WHERE customer_id = $2`,
                [withdrawal.withdrawal_amount, withdrawal.affiliate_id]
            );

            // Update status (use reviewed_at instead of updated_at)
            await pool.query(
                `UPDATE withdrawal_request SET status = 'APPROVED', admin_notes = $1, reviewed_at = NOW() WHERE id = $2`,
                [adminNotes || 'Approved by branch admin', withdrawalId]
            );

            // Log activity for all admins to see
            try {
                await pool.query(
                    `INSERT INTO activity_log 
                     (activity_type, actor_id, actor_name, actor_role, actor_branch, actor_area, actor_state, 
                      target_id, target_name, target_type, amount, description)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        'payment_approved',
                        withdrawal.affiliate_id,
                        withdrawal.branch + ' Admin',
                        'branch',
                        withdrawal.branch,
                        withdrawal.city,  // Area is the city
                        withdrawal.state,
                        withdrawal.affiliate_id,
                        `${withdrawal.first_name} ${withdrawal.last_name}`,
                        'withdrawal',
                        withdrawal.withdrawal_amount,
                        `approved ₹${parseFloat(withdrawal.withdrawal_amount).toFixed(2)} withdrawal for ${withdrawal.first_name} ${withdrawal.last_name}`
                    ]
                );
            } catch (e) {
                console.log("Activity log insert failed (table may not exist):", e);
            }

            await pool.end();
            return NextResponse.json({ success: true, message: "Withdrawal approved" });

        } else if (action === 'REJECT') {
            // Get withdrawal details for logging including city (area)
            const withdrawalResult = await pool.query(
                `SELECT wr.*, au.first_name, au.last_name, au.branch, au.city, au.state
                 FROM withdrawal_request wr
                 JOIN affiliate_user au ON au.id = wr.affiliate_id
                 WHERE wr.id = $1`,
                [withdrawalId]
            );

            await pool.query(
                `UPDATE withdrawal_request SET status = 'REJECTED', admin_notes = $1, reviewed_at = NOW() WHERE id = $2`,
                [adminNotes || 'Rejected by branch admin', withdrawalId]
            );

            // Log activity
            if (withdrawalResult.rows.length > 0) {
                const withdrawal = withdrawalResult.rows[0];
                try {
                    await pool.query(
                        `INSERT INTO activity_log 
                         (activity_type, actor_role, actor_branch, actor_area, actor_state, target_name, target_type, amount, description)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            'payment_rejected',
                            'branch',
                            withdrawal.branch,
                            withdrawal.city,  // Area is the city
                            withdrawal.state,
                            `${withdrawal.first_name} ${withdrawal.last_name}`,
                            'withdrawal',
                            withdrawal.withdrawal_amount,
                            `rejected ₹${parseFloat(withdrawal.withdrawal_amount).toFixed(2)} withdrawal for ${withdrawal.first_name} ${withdrawal.last_name}`
                        ]
                    );
                } catch (e) {
                    console.log("Activity log insert failed:", e);
                }
            }

            await pool.end();
            return NextResponse.json({ success: true, message: "Withdrawal rejected" });
        }

        await pool.end();
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Failed to process withdrawal:", error);
        return NextResponse.json({ success: false, message: "Failed to process" }, { status: 500 });
    }
}
