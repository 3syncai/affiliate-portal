import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// POST /api/admin/normalize-names
// Normalizes city, state, branch names to proper case (First letter caps, rest lowercase)
export async function POST() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Normalize affiliate_user table
        await pool.query(`
            UPDATE affiliate_user
            SET 
                city = INITCAP(LOWER(city)),
                state = INITCAP(LOWER(state)),
                branch = INITCAP(LOWER(branch))
            WHERE city IS NOT NULL OR state IS NOT NULL OR branch IS NOT NULL
        `);

        // Normalize branch_admin table
        await pool.query(`
            UPDATE branch_admin
            SET 
                city = INITCAP(LOWER(city)),
                state = INITCAP(LOWER(state)),
                branch = INITCAP(LOWER(branch))
            WHERE city IS NOT NULL OR state IS NOT NULL OR branch IS NOT NULL
        `);

        // Normalize area_sales_manager table
        await pool.query(`
            UPDATE area_sales_manager
            SET 
                city = INITCAP(LOWER(city)),
                state = INITCAP(LOWER(state))
            WHERE city IS NOT NULL OR state IS NOT NULL
        `);

        // Normalize state_admin table
        await pool.query(`
            UPDATE state_admin
            SET 
                state = INITCAP(LOWER(state))
            WHERE state IS NOT NULL
        `);

        // Normalize stores table
        await pool.query(`
            UPDATE stores
            SET 
                city = INITCAP(LOWER(city)),
                state = INITCAP(LOWER(state)),
                branch_name = INITCAP(LOWER(branch_name))
            WHERE city IS NOT NULL OR state IS NOT NULL OR branch_name IS NOT NULL
        `);

        await pool.end();

        return NextResponse.json({
            success: true,
            message: "All names normalized to proper case (First letter capitalized)"
        });

    } catch (error: any) {
        console.error("Normalization failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
