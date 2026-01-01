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

        console.log("Fetching ASM structure for state:", state);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get all cities from stores table in this state
        const citiesQuery = `
            SELECT DISTINCT city
            FROM stores
            WHERE state ILIKE $1 AND city IS NOT NULL
            ORDER BY city
        `;

        const citiesResult = await pool.query(citiesQuery, [state]);

        const asms = [];

        // Create an area entry for each city
        for (const cityRow of citiesResult.rows) {
            const branchesQuery = `
                SELECT 
                    s.branch_name,
                    COUNT(u.id) as agent_count
                FROM stores s
                LEFT JOIN affiliate_user u ON u.branch ILIKE s.branch_name AND u.is_agent = true
                WHERE s.city ILIKE $1 AND s.state ILIKE $2
                GROUP BY s.branch_name
                ORDER BY s.branch_name
            `;

            const branchesResult = await pool.query(branchesQuery, [cityRow.city, state]);

            const branches = branchesResult.rows.map(row => ({
                branch_name: row.branch_name,
                agent_count: parseInt(row.agent_count) || 0,
                total_earnings: 0
            }));

            if (branches.length > 0) {
                asms.push({
                    id: `city-${cityRow.city}`,
                    first_name: cityRow.city,
                    last_name: 'Area',
                    city: cityRow.city,
                    email: '',
                    branches
                });
            }
        }

        await pool.end();

        console.log(`Found ${asms.length} areas with branches for state: ${state}`);

        return NextResponse.json({
            success: true,
            asms
        });

    } catch (error: any) {
        console.error("Failed to fetch ASM structure:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
