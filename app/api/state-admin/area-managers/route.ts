import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Area Sales Managers ===");

    try {
        const { searchParams } = new URL(req.url);
        const stateAdminId = searchParams.get('state_admin_id');

        if (!stateAdminId) {
            return NextResponse.json(
                { success: false, message: "State admin ID is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(`
            SELECT id, first_name, last_name, email, phone, city, state, role, is_active, created_at, updated_at
            FROM area_sales_manager
            WHERE created_by = $1
            ORDER BY created_at DESC
        `, [stateAdminId]);

        await pool.end();

        console.log(`Found ${result.rows.length} ASMs for state admin ${stateAdminId}`);

        return NextResponse.json({
            success: true,
            areaManagers: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Failed to fetch ASMs:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch Area Sales Managers",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
