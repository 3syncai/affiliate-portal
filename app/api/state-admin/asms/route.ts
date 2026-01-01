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

        console.log("Fetching ASMs/Branches for state:", state);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get branches from stores table with agent counts
        const branchesQuery = `
            SELECT 
                s.branch_name as branch,
                s.city,
                COUNT(u.id) as agent_count,
                COUNT(CASE WHEN u.is_approved = true THEN 1 END) as active_agents
            FROM stores s
            LEFT JOIN affiliate_user u ON u.branch ILIKE s.branch_name AND u.is_agent = true
            WHERE s.state ILIKE $1
            GROUP BY s.branch_name, s.city
            ORDER BY s.city, s.branch_name
        `;

        const branchesResult = await pool.query(branchesQuery, [state]);

        // Also get distinct cities as areas
        const citiesQuery = `
            SELECT DISTINCT city, COUNT(*) as branch_count
            FROM stores
            WHERE state ILIKE $1 AND city IS NOT NULL
            GROUP BY city
            ORDER BY city
        `;
        const citiesResult = await pool.query(citiesQuery, [state]);

        await pool.end();

        // Format ASMs as branches grouped by city
        const asms = branchesResult.rows.map((row, index) => ({
            id: `branch-${index}`,
            first_name: row.branch,
            last_name: '',
            email: '',
            city: row.city,
            state: state,
            agent_count: parseInt(row.agent_count) || 0,
            active_agents: parseInt(row.active_agents) || 0,
            created_at: new Date().toISOString()
        }));

        console.log(`Found ${asms.length} branches in ${state}`);

        return NextResponse.json({
            success: true,
            asms,
            cities: citiesResult.rows,
            stats: {
                totalBranches: asms.length,
                totalCities: citiesResult.rows.length,
                totalAgents: asms.reduce((sum, a) => sum + a.agent_count, 0)
            }
        });

    } catch (error: any) {
        console.error("Failed to fetch ASMs:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
