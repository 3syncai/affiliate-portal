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

        // Sanitize state parameter: remove "State" suffix if present (e.g. "Maharashtra State" -> "Maharashtra")
        const cleanState = state.replace(/\s+State$/i, "").trim();
        console.log("Fetching activities for state:", cleanState, "(Original:", state, ")");

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
            const activityResult = await pool.query(activityLogQuery, [`%${cleanState}%`]);

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

        // 2. Get recent user creations with REFERRER details
        const approvalsQuery = `
            SELECT 
                u.id, u.first_name, u.last_name, u.branch, u.created_at, u.referred_by,
                -- Try to find who referred them
                b.first_name as b_first, b.last_name as b_last, 'Branch' as b_role,
                asm.first_name as asm_first, asm.last_name as asm_last, 'ASM' as asm_role,
                aff.first_name as aff_first, aff.last_name as aff_last, 'Affiliate' as aff_role
            FROM affiliate_user u
            LEFT JOIN branch_admin b ON u.referred_by = b.refer_code
            LEFT JOIN area_sales_manager asm ON u.referred_by = asm.refer_code
            LEFT JOIN affiliate_user aff ON u.referred_by = aff.refer_code
            WHERE u.state ILIKE $1 
            ORDER BY u.created_at DESC
            LIMIT 20
        `;

        try {
            const approvalsResult = await pool.query(approvalsQuery, [`%${cleanState}%`]);

            approvalsResult.rows.forEach(row => {
                let message = `${row.first_name} ${row.last_name} joined`;

                // Construct message based on referrer
                if (row.b_first) {
                    message = `Branch Admin ${row.b_first} ${row.b_last} referred ${row.first_name} ${row.last_name}`;
                } else if (row.asm_first) {
                    message = `ASM ${row.asm_first} ${row.asm_last} referred ${row.first_name} ${row.last_name}`;
                } else if (row.aff_first) {
                    message = `Affiliate ${row.aff_first} ${row.aff_last} referred ${row.first_name} ${row.last_name}`;
                } else if (!row.referred_by) {
                    message = `${row.first_name} ${row.last_name} joined directly`;
                }

                activities.push({
                    id: `approval-${row.id}`,
                    type: 'approval', // Keep type 'approval' or change to 'referral' if frontend supports it
                    message: message,
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
                COALESCE(u.first_name, ba.first_name) as first_name, 
                COALESCE(u.last_name, ba.last_name) as last_name, 
                COALESCE(u.branch, ba.branch) as branch,
                acl.commission_source
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            LEFT JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code OR (acl.commission_source = 'branch_admin' AND acl.affiliate_user_id = ba.id::text)
            WHERE (u.state ILIKE $1 OR ba.state ILIKE $1)
            ORDER BY acl.created_at DESC
            LIMIT 30
        `;

        try {
            const commissionsResult = await pool.query(commissionsQuery, [`%${cleanState}%`]);

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

        console.log(`Found ${recentActivities.length} activities for state: ${state} `);

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
