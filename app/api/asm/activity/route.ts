import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// GET /api/asm/activity?area=<city>
// Returns recent activities for all branches under this ASM's area (city)
export async function GET(request: NextRequest) {
    console.log("=== Fetching ASM Recent Activity ===");

    try {
        const { searchParams } = new URL(request.url);
        const area = searchParams.get("area");

        if (!area) {
            return NextResponse.json({
                success: false,
                error: "Area parameter required"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const activities: any[] = [];

        // 1. Get recent commissions from all branches in this area
        // Join through branch_admin to get branches in this ASM's area
        const commissionsQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.product_name,
                acl.affiliate_code,
                COALESCE(acl.affiliate_commission, acl.commission_amount * 0.70) as amount,
                acl.created_at,
                u.first_name,
                u.last_name,
                u.branch as branch_name
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN branch_admin ba ON ba.branch = u.branch
            WHERE ba.city ILIKE $1
            ORDER BY acl.created_at DESC
            LIMIT 15
        `;

        const commissionsResult = await pool.query(commissionsQuery, [area]);

        commissionsResult.rows.forEach(row => {
            activities.push({
                id: `commission-${row.id}`,
                type: 'commission_earned',
                timestamp: row.created_at,
                data: {
                    message: `In ${row.branch_name} branch, affiliate ${row.first_name} ${row.last_name} earned ₹${parseFloat(row.amount).toFixed(2)} commission on ${row.product_name}`,
                    name: `${row.first_name} ${row.last_name}`,
                    branch_name: row.branch_name,
                    amount: parseFloat(row.amount),
                    product_name: row.product_name
                }
            });
        });

        // 2. Get recent withdrawal requests from all branches in this area
        const withdrawalsQuery = `
            SELECT 
                wr.id,
                wr.withdrawal_amount as amount,
                wr.status,
                wr.requested_at as created_at,
                wr.reviewed_at,
                u.first_name,
                u.last_name,
                u.branch as branch_name
            FROM withdrawal_request wr
            JOIN affiliate_user u ON wr.affiliate_id = u.id
            JOIN branch_admin ba ON ba.branch = u.branch
            WHERE ba.city ILIKE $1
            ORDER BY wr.requested_at DESC
            LIMIT 15
        `;

        try {
            const withdrawalsResult = await pool.query(withdrawalsQuery, [area]);

            withdrawalsResult.rows.forEach(row => {
                if (row.status === 'APPROVED' || row.status === 'PAID') {
                    activities.push({
                        id: `approval-${row.id}`,
                        type: 'payment_approved',
                        timestamp: row.reviewed_at || row.created_at,
                        data: {
                            message: `In ${row.branch_name} branch, approved ₹${parseFloat(row.amount).toFixed(2)} withdrawal for ${row.first_name} ${row.last_name}`,
                            name: `${row.first_name} ${row.last_name}`,
                            branch_name: row.branch_name,
                            amount: parseFloat(row.amount)
                        }
                    });
                } else if (row.status === 'PENDING') {
                    activities.push({
                        id: `withdrawal-${row.id}`,
                        type: 'withdrawal_requested',
                        timestamp: row.created_at,
                        data: {
                            message: `In ${row.branch_name} branch, ${row.first_name} ${row.last_name} requested ₹${parseFloat(row.amount).toFixed(2)} withdrawal`,
                            name: `${row.first_name} ${row.last_name}`,
                            branch_name: row.branch_name,
                            amount: parseFloat(row.amount)
                        }
                    });
                }
            });
        } catch (e) {
            console.log("Could not fetch withdrawals:", e);
        }

        // 3. Get affiliate approvals from all branches in this area
        const approvalsQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.branch as branch_name,
                u.updated_at,
                u.created_at
            FROM affiliate_user u
            JOIN branch_admin ba ON ba.branch = u.branch
            WHERE ba.city ILIKE $1
            AND u.is_approved = true
            AND u.is_agent = true
            ORDER BY u.updated_at DESC
            LIMIT 10
        `;

        try {
            const approvalsResult = await pool.query(approvalsQuery, [area]);

            approvalsResult.rows.forEach(row => {
                activities.push({
                    id: `affiliate-approval-${row.id}`,
                    type: 'affiliate_approved',
                    timestamp: row.updated_at || row.created_at,
                    data: {
                        message: `In ${row.branch_name} branch, ${row.first_name} ${row.last_name} was approved as affiliate`,
                        name: `${row.first_name} ${row.last_name}`,
                        branch_name: row.branch_name
                    }
                });
            });
        } catch (e) {
            console.log("Could not fetch approvals:", e);
        }

        await pool.end();

        // Sort all activities by timestamp
        activities.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return dateB - dateA;
        });

        // Return top 20
        const recentActivities = activities.slice(0, 20);

        console.log(`Returning ${recentActivities.length} recent activities for area: ${area}`);

        return NextResponse.json({
            success: true,
            activities: recentActivities
        });

    } catch (error: any) {
        console.error("Failed to fetch ASM activities:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
