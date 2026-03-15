import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId');

        if (!state) {
            return NextResponse.json({ success: false, error: "State parameter is required" }, { status: 400 });
        }

        console.log("Fetching ASMs for state:", state, "Admin ID:", adminId);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Query the REAL area_sales_manager table
        // Filter by created_by if adminId is provided, otherwise fallback to state
        let query = `
            SELECT id, first_name, last_name, email, city, state, created_at, role, is_active, refer_code
            FROM area_sales_manager
            WHERE state ILIKE $1
        `;

        const params: any[] = [state];

        if (adminId) {
            query += ` AND created_by = $2`;
            params.push(adminId);
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);

        await pool.end();

        return NextResponse.json({
            success: true,
            asms: result.rows,
            stats: {
                totalBranches: result.rows.length,
                totalCities: new Set(result.rows.map((r: any) => r.city)).size,
                totalAgents: 0 // We can add agent count logic later if needed by joining affiliate_user
            }
        });

    } catch (error: any) {
        console.error("Failed to fetch ASMs:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
