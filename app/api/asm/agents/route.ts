import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching Agents for ASM ===");

    try {
        const { searchParams } = new URL(request.url);
        const city = searchParams.get('city');
        const state = searchParams.get('state');

        if (!city) {
            return NextResponse.json(
                { success: false, error: "City parameter is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get all affiliates in the city/state through stores table (linked by branch)
        // Affiliates are linked to branches, branches are in stores with city/state
        let query;
        let params;

        if (state) {
            query = `
                SELECT DISTINCT
                    a.id, a.first_name, a.last_name, a.email, a.phone, a.refer_code,
                    a.is_agent, a.is_approved, a.designation, a.branch, a.city, a.created_at
                FROM affiliate_user a
                LEFT JOIN stores s ON LOWER(a.branch) = LOWER(s.branch_name)
                WHERE (LOWER(s.city) = LOWER($1) AND LOWER(s.state) = LOWER($2))
                   OR LOWER(a.city) = LOWER($1)
                ORDER BY a.created_at DESC
            `;
            params = [city, state];
        } else {
            query = `
                SELECT DISTINCT
                    a.id, a.first_name, a.last_name, a.email, a.phone, a.refer_code,
                    a.is_agent, a.is_approved, a.designation, a.branch, a.city, a.created_at
                FROM affiliate_user a
                LEFT JOIN stores s ON LOWER(a.branch) = LOWER(s.branch_name)
                WHERE LOWER(s.city) = LOWER($1) OR LOWER(a.city) = LOWER($1)
                ORDER BY a.created_at DESC
            `;
            params = [city];
        }

        const result = await pool.query(query, params);

        await pool.end();

        console.log(`Found ${result.rows.length} agents in ${city}`);

        return NextResponse.json({
            success: true,
            agents: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Failed to fetch agents:", error);
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
