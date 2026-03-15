import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Admins ===");

    try {
        const { searchParams } = new URL(req.url);
        const asmId = searchParams.get('asm_id');
        const city = searchParams.get('city');
        const state = searchParams.get('state');

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        let result;

        if (asmId) {
            // Query by ASM ID (creator)
            result = await pool.query(`
                SELECT id, first_name, last_name, email, phone, branch, city, state, role, is_active, created_at, updated_at
                FROM branch_admin
                WHERE created_by = $1
                ORDER BY created_at DESC
            `, [asmId]);
        } else if (city && state) {
            // Query by city and state
            result = await pool.query(`
                SELECT id, first_name, last_name, email, phone, branch, city, state, role, is_active, created_at, updated_at
                FROM branch_admin
                WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
                ORDER BY created_at DESC
            `, [city, state]);
        } else {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "ASM ID or City/State is required" },
                { status: 400 }
            );
        }

        await pool.end();

        console.log(`Found ${result.rows.length} branch admins`);

        return NextResponse.json({
            success: true,
            branchAdmins: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Failed to fetch branch admins:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch Branch Admins",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
