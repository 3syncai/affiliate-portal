import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Fetching All Area Managers ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Columns: id, first_name, last_name, email, phone, city, state, created_by, role, is_active, created_at, updated_at
        const result = await pool.query(`
            SELECT id, first_name, last_name, email, phone, city, state, role, is_active, created_at, updated_at
            FROM area_sales_manager
            ORDER BY created_at DESC
        `);

        await pool.end();

        // Map to add 'name' field and 'area' as city
        const managers = result.rows.map(row => ({
            ...row,
            name: `${row.first_name} ${row.last_name}`.trim(),
            area: row.city // Use city as area
        }));

        console.log(`Found ${managers.length} area managers`);

        return NextResponse.json({
            success: true,
            managers,
            count: managers.length
        });

    } catch (error) {
        console.error("Failed to fetch area managers:", error);
        return NextResponse.json({
            success: false,
            managers: [],
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
