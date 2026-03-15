import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Commissions ===");

    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get all affiliates in this branch with their commission data
        const result = await pool.query(`
            SELECT 
                au.id as user_id,
                au.first_name,
                au.last_name,
                au.email,
                au.phone,
                au.refer_code as referral_code,
                au.branch,
                COALESCE(cw.wallet_amount, 0) as wallet_amount,
                COALESCE(cw.total_commission, 0) as total_commission,
                COALESCE(cw.pending_amount, 0) as pending_amount,
                COALESCE(cw.total_orders, 0) as total_orders
            FROM affiliate_user au
            LEFT JOIN customer_wallet cw ON cw.affiliate_id = au.id
            WHERE au.branch ILIKE $1 AND au.is_agent = true AND au.is_approved = true
            ORDER BY cw.total_commission DESC NULLS LAST
        `, [branch]);

        await pool.end();

        console.log(`Found ${result.rows.length} affiliates for branch: ${branch}`);

        return NextResponse.json({
            success: true,
            affiliates: result.rows
        });
    } catch (error: any) {
        console.error("Failed to fetch branch commissions:", error);
        return NextResponse.json({ success: true, affiliates: [] });
    }
}
