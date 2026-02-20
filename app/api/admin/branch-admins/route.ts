import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

interface BranchAdmin {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    branch: string;
    city: string;
    state: string;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export async function GET() {
    console.log("=== Fetching All Branch Admins ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Columns: id, first_name, last_name, email, phone, branch, city, state, created_by, role, is_active, created_at, updated_at
        const result = await pool.query(`
            SELECT id, first_name, last_name, email, phone, branch, city, state, role, is_active, created_at, updated_at
            FROM branch_admin
            ORDER BY created_at DESC
        `);

        await pool.end();

        // Map to add 'name' field and 'area' as city
        const admins = result.rows.map((row: BranchAdmin) => ({
            ...row,
            name: `${row.first_name} ${row.last_name}`.trim(),
            area: row.city // Use city as area
        }));

        console.log(`Found ${admins.length} branch admins`);

        return NextResponse.json({
            success: true,
            admins,
            count: admins.length
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch branch admins:", err);
        return NextResponse.json({
            success: false,
            admins: [],
            error: err.message
        }, { status: 500 });
    }
}
