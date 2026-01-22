import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

type Activity = {
    id: string;
    type: string;
    timestamp: string;
    data: any;
};

export async function GET() {
    console.log("=== Fetching Main Admin Activity ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false
        });

        const activities: Activity[] = [];

        // 1. Get all activities from activity_log (main admin sees everything)
        try {
            const activityLogQuery = `
                SELECT 
                    id,
                    activity_type,
                    actor_name,
                    actor_branch,
                    actor_area,
                    actor_state,
                    target_name,
                    amount,
                    product_name,
                    description,
                    created_at,
                    metadata
                FROM activity_log
                ORDER BY created_at DESC
                LIMIT 50
            `;

            const activityResult = await pool.query(activityLogQuery);

            activityResult.rows.forEach(row => {
                // For main admin, show full hierarchy in description
                let message = row.description;

                // If description doesn't already have state context, add it
                if (row.actor_state && !message.includes(row.actor_state)) {
                    const statePrefix = `In ${row.actor_state} state, `;
                    if (!message.startsWith('In ')) {
                        message = statePrefix + message;
                    }
                }

                activities.push({
                    id: `activity-${row.id}`,
                    type: row.activity_type,
                    timestamp: row.created_at,
                    data: {
                        message,
                        state: row.actor_state,
                        area: row.actor_area,
                        branch_name: row.actor_branch,
                        amount: parseFloat(row.amount) || 0,
                        affiliate_name: row.target_name,
                        product_name: row.product_name,
                        metadata: row.metadata
                    }
                });
            });
        } catch (err) {
            console.log("Activity log query failed:", err);
        }

        // 2. Get recent affiliate approvals from all states
        const affiliateRequestsQuery = `
            SELECT 
                au.id,
                au.first_name,
                au.last_name,
                au.email,
                au.is_approved,
                au.is_agent,
                au.branch,
                au.city,
                au.state,
                au.created_at,
                au.updated_at
            FROM affiliate_user au
            WHERE au.is_approved = true AND au.is_agent = true
            ORDER BY au.updated_at DESC
            LIMIT 20
        `;

        try {
            const affiliateResult = await pool.query(affiliateRequestsQuery);

            affiliateResult.rows.forEach(row => {
                const stateStr = row.state ? `In ${row.state} state, ` : '';
                const areaStr = row.city ? `${row.city} area, ` : '';
                const branchStr = row.branch ? `${row.branch} branch, ` : '';

                activities.push({
                    id: `approval_${row.id}`,
                    type: 'affiliate_approved',
                    timestamp: row.updated_at || row.created_at,
                    data: {
                        message: `${stateStr}${areaStr}${branchStr}${row.first_name} ${row.last_name} was approved as affiliate`,
                        name: `${row.first_name} ${row.last_name}`,
                        email: row.email,
                        state: row.state,
                        area: row.city,
                        branch_name: row.branch,
                        action: 'approved as affiliate'
                    }
                });
            });
        } catch (err) {
            console.log("Affiliate requests query failed:", err);
        }

        // 3. Get recent commissions from all states
        const commissionsQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.affiliate_code,
                acl.product_name,
                acl.commission_amount,
                acl.created_at,
                au.first_name,
                au.last_name,
                au.branch,
                au.city,
                au.state
            FROM affiliate_commission_log acl
            JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
            ORDER BY acl.created_at DESC
            LIMIT 30
        `;

        try {
            const commissionsResult = await pool.query(commissionsQuery);

            commissionsResult.rows.forEach(row => {
                const affiliateName = `${row.first_name} ${row.last_name}`;
                const amount = parseFloat(row.commission_amount) || 0;

                const stateStr = row.state ? `In ${row.state} state, ` : '';
                const areaStr = row.city ? `${row.city} area, ` : '';
                const branchStr = row.branch ? `${row.branch} branch, ` : '';

                activities.push({
                    id: `commission_${row.id}`,
                    type: 'commission_earned',
                    timestamp: row.created_at,
                    data: {
                        message: `${stateStr}${areaStr}${branchStr}affiliate ${affiliateName} earned ₹${amount.toFixed(2)} commission on ${row.product_name}`,
                        name: affiliateName,
                        state: row.state,
                        area: row.city,
                        branch_name: row.branch,
                        order_id: row.order_id,
                        product_name: row.product_name,
                        commission_amount: amount,
                        action: `earned ₹${amount.toFixed(2)} commission`
                    }
                });
            });
        } catch (err) {
            console.log("Commissions query failed:", err);
        }

        // 4. Get recent withdrawals from all states
        const withdrawalsQuery = `
            SELECT 
                wr.id,
                wr.withdrawal_amount,
                wr.status,
                wr.requested_at,
                au.first_name,
                au.last_name,
                au.branch,
                au.city,
                au.state
            FROM withdrawal_request wr
            JOIN affiliate_user au ON wr.affiliate_id = au.id
            ORDER BY wr.requested_at DESC
            LIMIT 20
        `;

        try {
            const withdrawalsResult = await pool.query(withdrawalsQuery);

            withdrawalsResult.rows.forEach(row => {
                const affiliateName = `${row.first_name} ${row.last_name}`;
                const amount = parseFloat(row.withdrawal_amount) || 0;

                const stateStr = row.state ? `In ${row.state} state, ` : '';
                const areaStr = row.city ? `${row.city} area, ` : '';
                const branchStr = row.branch ? `${row.branch} branch, ` : '';

                activities.push({
                    id: `withdrawal_${row.id}`,
                    type: 'withdrawal_requested',
                    timestamp: row.requested_at,
                    data: {
                        message: `${stateStr}${areaStr}${branchStr}affiliate ${affiliateName} requested ₹${amount.toFixed(2)} withdrawal`,
                        name: affiliateName,
                        state: row.state,
                        area: row.city,
                        branch_name: row.branch,
                        amount: amount,
                        status: row.status,
                        action: `requested ₹${amount.toFixed(2)} withdrawal`
                    }
                });
            });
        } catch (err) {
            console.log("Withdrawals query failed:", err);
        }

        await pool.end();

        // Sort by timestamp (most recent first) and limit to 50
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recentActivities = activities.slice(0, 50);

        console.log(`Returning ${recentActivities.length} recent activities for main admin`);
        return NextResponse.json({
            success: true,
            activities: recentActivities,
            count: recentActivities.length
        });

    } catch (error) {
        console.error("Failed to fetch main admin activity:", error);
        return NextResponse.json({
            success: false,
            activities: [],
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
