import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');

        if (!state) {
            return NextResponse.json({ success: false, error: "State parameter is required" }, { status: 400 });
        }

        console.log("Fetching activities for state:", state);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const activities: any[] = [];

        // 1. Get payment activities from activity_log (most important!)
        try {
            const activityLogQuery = `
                SELECT 
                    id,
                    activity_type,
                    actor_name,
                    actor_branch,
                    target_name,
                    amount,
                    description,
                    created_at
                FROM activity_log
                WHERE actor_state ILIKE $1
                ORDER BY created_at DESC
                LIMIT 20
            `;
            const activityResult = await pool.query(activityLogQuery, [`%${state}%`]);

            activityResult.rows.forEach(row => {
                activities.push({
                    id: `activity-${row.id}`,
                    type: row.activity_type,
                    message: row.description,
                    branch_name: row.actor_branch || 'Unknown Branch',
                    amount: parseFloat(row.amount) || 0,
                    created_at: row.created_at
                });
            });
        } catch (err) {
            console.log("Activity log query failed (table may not exist):", err);
        }

        // 2. Get recent user creations/signups as "approvals"
        const approvalsQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.branch,
                u.created_at
            FROM affiliate_user u
            WHERE u.state ILIKE $1 
            ORDER BY u.created_at DESC
            LIMIT 20
        `;

        try {
            const approvalsResult = await pool.query(approvalsQuery, [`%${state}%`]);

            approvalsResult.rows.forEach(row => {
                activities.push({
                    id: `approval-${row.id}`,
                    type: 'approval',
                    message: `${row.first_name} ${row.last_name} was approved as an affiliate`,
                    branch_name: row.branch || 'Unknown Branch',
                    created_at: row.created_at
                });
            });
        } catch (err) {
            console.error("Failed to fetch approvals:", err);
        }

        // 3. Get recent commissions from affiliate_commission_log
        const commissionsQuery = `
            SELECT 
                acl.id,
                acl.order_amount,
                acl.commission_amount,
                acl.created_at,
                u.first_name,
                u.last_name,
                u.branch
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.state ILIKE $1
            ORDER BY acl.created_at DESC
            LIMIT 30
        `;

        try {
            const commissionsResult = await pool.query(commissionsQuery, [`%${state}%`]);

            commissionsResult.rows.forEach(row => {
                activities.push({
                    id: `commission-${row.id}`,
                    type: 'commission',
                    message: `${row.first_name} ${row.last_name} earned ₹${parseFloat(row.commission_amount).toFixed(2)} commission`,
                    branch_name: row.branch || 'Unknown Branch',
                    created_at: row.created_at
                });
            });
        } catch (err) {
            console.error("Failed to fetch commissions:", err);
        }

        // Sort all activities by date
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Take top 50
        const recentActivities = activities.slice(0, 50);

        console.log(`Found ${recentActivities.length} activities for state: ${state}`);

        await pool.end();

        return NextResponse.json({
            success: true,
            activities: recentActivities
        });

    } catch (error: any) {
        console.error("Failed to fetch recent activities:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
