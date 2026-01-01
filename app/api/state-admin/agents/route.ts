import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching State Agents ===");

    try {
        const { searchParams } = new URL(request.url);
        const state = searchParams.get('state');

        if (!state) {
            return NextResponse.json(
                { success: false, error: "State parameter is required" },
                { status: 400 }
            );
        }

        console.log("Fetching agents for state:", state);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get all agents linked to stores in this state
        const result = await pool.query(
            `SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, u.refer_code,
                u.branch, u.city, u.is_agent, u.is_approved, u.designation, u.created_at,
                s.branch_name, s.city as store_city
             FROM affiliate_user u
             JOIN stores s ON u.branch ILIKE s.branch_name
             WHERE s.state ILIKE $1 AND u.is_agent = true
             ORDER BY u.branch, u.created_at DESC`,
            [state]
        );

        await pool.end();

        console.log(`Found ${result.rows.length} agents in ${state}`);

        // Group agents by branch
        const branchMap: { [key: string]: any[] } = {};
        result.rows.forEach(agent => {
            const branchName = agent.branch || agent.branch_name || 'Unassigned';
            if (!branchMap[branchName]) {
                branchMap[branchName] = [];
            }
            branchMap[branchName].push(agent);
        });

        const branches = Object.keys(branchMap).map(branchName => ({
            name: branchName,
            agents: branchMap[branchName],
            count: branchMap[branchName].length
        }));

        return NextResponse.json({
            success: true,
            agents: result.rows,
            branches,
            count: result.rows.length,
            branchCount: branches.length
        });

    } catch (error) {
        console.error("Failed to fetch state agents:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch agents",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
