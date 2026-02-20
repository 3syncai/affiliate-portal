import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Check what states exist
        const statesQuery = `SELECT DISTINCT state FROM affiliate_user WHERE state IS NOT NULL`;
        const statesResult = await pool.query(statesQuery);

        // Check what cities exist
        const citiesQuery = `SELECT DISTINCT city FROM affiliate_user WHERE city IS NOT NULL`;
        const citiesResult = await pool.query(citiesQuery);

        // Check what branches exist
        const branchesQuery = `SELECT DISTINCT branch FROM affiliate_user WHERE branch IS NOT NULL`;
        const branchesResult = await pool.query(branchesQuery);

        // Get sample users
        const usersQuery = `SELECT id, first_name, last_name, state, city, branch, email FROM affiliate_user LIMIT 10`;
        const usersResult = await pool.query(usersQuery);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM affiliate_user`;
        const countResult = await pool.query(countQuery);

        await pool.end();

        return NextResponse.json({
            success: true,
            debug: {
                states: statesResult.rows,
                cities: citiesResult.rows,
                branches: branchesResult.rows,
                sampleUsers: usersResult.rows,
                totalUsers: countResult.rows[0]?.total
            }
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Debug query failed:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
