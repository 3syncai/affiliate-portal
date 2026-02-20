import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

type Activity = {
    id: string;
    type: 'affiliate_request' | 'order' | 'approval' | 'withdrawal' | 'payment';
    timestamp: string;
    data: Record<string, string | number | boolean | null | undefined>;
};

interface WithdrawalRow {
    id: string;
    amount: string;
    status: string;
    created_at: string;
    first_name: string;
    last_name: string;
}

interface PaymentRow {
    id: string;
    amount: string;
    transaction_id: string;
    payment_date: string;
    updated_at: string;
    first_name: string;
    last_name: string;
}

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Recent Activity ===");

    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get("branch");

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Fetch recent affiliate requests from this branch (last 10)
        const affiliateRequestsQuery = `
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone,
                is_approved,
                is_agent,
                branch,
                created_at,
                updated_at
            FROM affiliate_user
            WHERE branch ILIKE $1
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const affiliateRequestsResult = await pool.query(affiliateRequestsQuery, [branch]);

        // Fetch recent orders with commissions from this branch (last 10)
        const recentOrdersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.affiliate_code,
                acl.product_name,
                acl.commission_amount,
                acl.status,
                acl.created_at,
                u.first_name as affiliate_first_name,
                u.last_name as affiliate_last_name
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.branch ILIKE $1
            ORDER BY acl.created_at DESC
            LIMIT 10
        `;
        const recentOrdersResult = await pool.query(recentOrdersQuery, [branch]);

        // Fetch recent withdrawal requests from this branch (last 5)
        const withdrawalsQuery = `
            SELECT 
                wr.id,
                wr.amount,
                wr.status,
                wr.created_at,
                u.first_name,
                u.last_name
            FROM withdrawal_request wr
            JOIN affiliate_user u ON wr.affiliate_id = u.id
            WHERE u.branch ILIKE $1
            ORDER BY wr.created_at DESC
            LIMIT 5
        `;
        let withdrawalsResultRows: WithdrawalRow[] = [];
        try {
            const res = await pool.query(withdrawalsQuery, [branch]);
            withdrawalsResultRows = res.rows;
        } catch (error: unknown) {
            console.log("Could not fetch withdrawals:", error);
        }

        // Fetch recent payment completions (PAID withdrawals with transaction details)
        const paymentsQuery = `
            SELECT 
                wr.id,
                wr.amount,
                wr.transaction_id,
                wr.payment_date,
                wr.updated_at,
                u.first_name,
                u.last_name
            FROM withdrawal_request wr
            JOIN affiliate_user u ON wr.affiliate_id = u.id
            WHERE u.branch ILIKE $1 AND wr.status = 'PAID'
            ORDER BY wr.payment_date DESC
            LIMIT 10
        `;
        let paymentsResultRows: PaymentRow[] = [];
        try {
            const res = await pool.query(paymentsQuery, [branch]);
            paymentsResultRows = res.rows;
        } catch (error: unknown) {
            console.log("Could not fetch payment completions:", error);
        }

        await pool.end();

        // Combine and format activities
        const activities: Activity[] = [];

        // Add affiliate requests
        affiliateRequestsResult.rows.forEach(row => {
            if (row.is_approved && row.is_agent) {
                activities.push({
                    id: `approval_${row.id}`,
                    type: 'approval',
                    timestamp: row.updated_at || row.created_at,
                    data: {
                        name: `${row.first_name} ${row.last_name}`,
                        email: row.email,
                        action: 'approved as affiliate'
                    }
                });
            } else if (!row.is_approved) {
                activities.push({
                    id: `request_${row.id}`,
                    type: 'affiliate_request',
                    timestamp: row.created_at,
                    data: {
                        name: `${row.first_name} ${row.last_name}`,
                        email: row.email,
                        action: 'submitted affiliate request'
                    }
                });
            }
        });

        // Add recent orders
        recentOrdersResult.rows.forEach(row => {
            activities.push({
                id: `order_${row.id}`,
                type: 'order',
                timestamp: row.created_at,
                data: {
                    name: row.affiliate_first_name && row.affiliate_last_name
                        ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                        : row.affiliate_code,
                    order_id: row.order_id,
                    product_name: row.product_name,
                    commission_amount: parseFloat(row.commission_amount) || 0,
                    action: `earned ₹${(parseFloat(row.commission_amount) || 0).toFixed(2)} commission`
                }
            });
        });

        // Add withdrawals
        withdrawalsResultRows.forEach((row) => {
            activities.push({
                id: `withdrawal_${row.id}`,
                type: 'withdrawal',
                timestamp: row.created_at,
                data: {
                    name: `${row.first_name} ${row.last_name}`,
                    amount: parseFloat(row.amount) || 0,
                    status: row.status,
                    action: `requested ₹${(parseFloat(row.amount) || 0).toFixed(2)} withdrawal`
                }
            });
        });

        // Add payment completions
        paymentsResultRows.forEach((row) => {
            activities.push({
                id: `payment_${row.id}`,
                type: 'payment',
                timestamp: row.payment_date || row.updated_at,
                data: {
                    name: `${row.first_name} ${row.last_name}`,
                    amount: parseFloat(row.amount) || 0,
                    transaction_id: row.transaction_id,
                    action: `paid ₹${(parseFloat(row.amount) || 0).toFixed(2)} to affiliate`
                }
            });
        });

        // Sort by timestamp (most recent first) and limit to 15
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recentActivities = activities.slice(0, 15);

        console.log(`Returning ${recentActivities.length} recent activities for branch: ${branch}`);
        return NextResponse.json({
            success: true,
            activities: recentActivities,
            count: recentActivities.length
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch branch activity:", err);
        return NextResponse.json({
            success: false,
            activities: [],
            error: err.message
        }, { status: 500 });
    }
}
