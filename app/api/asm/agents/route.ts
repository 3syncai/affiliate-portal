import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    console.log("=== Fetching Agents for ASM ===");

    try {
        const { searchParams } = new URL(request.url);
        const city = searchParams.get('city');
        const state = searchParams.get('state');

        if (!city || !state) {
            return NextResponse.json(
                { success: false, error: "City and State parameters are required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `SELECT
                u.id, u.first_name, u.last_name, u.email, u.phone, u.refer_code,
                u.is_agent, u.is_approved, u.designation, u.branch, u.city, u.created_at
             FROM affiliate_user u
             JOIN stores s ON u.branch ILIKE s.branch_name
             WHERE s.city ILIKE $1 AND s.state ILIKE $2 AND u.is_agent = true
             ORDER BY u.created_at DESC`,
            [city, state]
        );

        await pool.end();

        console.log(`Found ${result.rows.length} agents in ${city}, ${state}`);

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
