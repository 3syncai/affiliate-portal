import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching Affiliate Users for Branch ===");

    try {
        const { searchParams } = new URL(request.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        console.log(`Searching for affiliates in branch: ${branch}`);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get pending users (not approved) - exact match or partial match
        const pendingResult = await pool.query(
            `SELECT *
             FROM affiliate_user 
             WHERE (branch ILIKE $1 OR branch ILIKE $2) AND is_approved = false AND is_agent = true
             ORDER BY created_at DESC`,
            [branch, `%${branch}%`]
        );

        // Get approved users
        const approvedResult = await pool.query(
            `SELECT *
             FROM affiliate_user 
             WHERE (branch ILIKE $1 OR branch ILIKE $2) AND is_approved = true AND is_agent = true
             ORDER BY created_at DESC`,
            [branch, `%${branch}%`]
        );


        console.log(`Found ${pendingResult.rows.length} pending and ${approvedResult.rows.length} approved affiliates for branch: ${branch}`);


        return NextResponse.json({
            success: true,
            pending: pendingResult.rows,
            approved: approvedResult.rows
        });
    } catch (error) {
        console.error("Failed to fetch affiliate users:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch affiliate users" }, { status: 500 });
    }
}
