import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

interface ASM {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    city: string;
    state: string;
    created_at: Date;
    role: string;
    is_active: boolean;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId');

        if (!state) {
            return NextResponse.json({ success: false, error: "State parameter is required" }, { status: 400 });
        }

        console.log("Fetching ASMs for state:", state, "Admin ID:", adminId);

        console.log("Fetching ASMs for state:", state, "Admin ID:", adminId);

        // Query the REAL area_sales_manager table
        // Filter by created_by if adminId is provided, otherwise fallback to state
        let query = `
            SELECT id, first_name, last_name, email, city, state, created_at, role, is_active
            FROM area_sales_manager
            WHERE state ILIKE $1
        `;

        const params: (string | number)[] = [state];

        if (adminId) {
            query += ` AND created_by = $2`;
            params.push(adminId);
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);


        return NextResponse.json({
            success: true,
            asms: result.rows,
            stats: {
                totalBranches: result.rows.length,
                totalCities: new Set(result.rows.map((r: ASM) => r.city)).size,
                totalAgents: 0 // We can add agent count logic later if needed by joining affiliate_user
            }
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch ASMs:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
