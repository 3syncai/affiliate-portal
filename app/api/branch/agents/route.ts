import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching Agents for Branch ===");

    try {
        const { searchParams } = new URL(request.url);
        const branch = searchParams.get('branch');
        const approvedOnly = searchParams.get('approved') === 'true';

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const approvedClause = approvedOnly ? " AND au.is_approved = true" : "";

        const result = await pool.query(
            `SELECT
                au.id,
                au.first_name,
                au.last_name,
                au.email,
                au.phone,
                au.refer_code,
                au.is_agent,
                au.is_approved,
                au.rejected_at,
                au.entry_sponsor,
                au.branch,
                au.city,
                au.state,
                au.country,
                au.payment_method,
                au.bank_name,
                au.bank_branch,
                au.ifsc_code,
                au.account_name,
                au.account_number,
                au.upi_id,
                au.created_at,
                au.updated_at,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM affiliate_commission_log
                    WHERE affiliate_code = au.refer_code
                ), 0) AS total_orders,
                COALESCE((
                    SELECT SUM(COALESCE(affiliate_amount, affiliate_commission, 0))
                    FROM affiliate_commission_log
                    WHERE affiliate_code = au.refer_code AND status = 'CREDITED'
                ), 0) AS total_commission,
                COALESCE((
                    SELECT SUM(COALESCE(affiliate_amount, affiliate_commission, 0))
                    FROM affiliate_commission_log
                    WHERE affiliate_code = au.refer_code AND status = 'PENDING'
                ), 0) AS pending_commission,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM customer
                    WHERE metadata->>'referral_code' = au.refer_code
                ), 0) AS total_referred_customers
             FROM affiliate_user au
             WHERE au.branch ILIKE $1 AND au.is_agent = true${approvedClause}
             ORDER BY au.created_at DESC`,
            [branch]
        );

        await pool.end();

        console.log(`Found ${result.rows.length} agents in branch ${branch}`);

        return NextResponse.json({ success: true, agents: result.rows, count: result.rows.length });
    } catch (error) {
        console.error("Failed to fetch agents:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch agents" }, { status: 500 });
    }
}
