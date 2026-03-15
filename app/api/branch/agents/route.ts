import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching Agents for Branch ===");

    try {
        const { searchParams } = new URL(request.url);
        const branch = searchParams.get('branch');

        if (!branch) {
            return NextResponse.json({ success: false, error: "Branch parameter is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `SELECT id, first_name, last_name, email, phone, refer_code, is_agent, is_approved, branch, created_at
             FROM affiliate_user 
             WHERE branch ILIKE $1 AND is_agent = true
             ORDER BY created_at DESC`,
            [`%${branch}%`]
        );

        await pool.end();

        console.log(`Found ${result.rows.length} agents in branch ${branch}`);

        return NextResponse.json({ success: true, agents: result.rows, count: result.rows.length });
    } catch (error) {
        console.error("Failed to fetch agents:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch agents" }, { status: 500 });
    }
}
