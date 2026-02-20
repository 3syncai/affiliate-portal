import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET() {
    console.log("=== Fetching All State Admins ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(`
            SELECT id, first_name, last_name, email, phone, state, role, is_active, created_at, updated_at
            FROM state_admin
            ORDER BY created_at DESC
        `);

        await pool.end();

        console.log(`Found ${result.rows.length} state admins`);

        return NextResponse.json({
            success: true,
            stateAdmins: result.rows,
            count: result.rows.length
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch state admins:", err);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch state admins",
                message: err.message
            },
            { status: 500 }
        );
    }
}
