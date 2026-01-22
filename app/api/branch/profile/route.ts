import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // Get email from query params (typically from session/auth)
        const { searchParams } = new URL(req.url);
        const email = searchParams.get("email");

        if (!email) {
            return NextResponse.json(
                { success: false, message: "Email is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Fetch branch admin profile
        const result = await pool.query(
            `SELECT 
                id, first_name, last_name, email, phone, refer_code, 
                branch, city, state, role, is_active, created_at
            FROM branch_admin 
            WHERE email = $1`,
            [email]
        );

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Branch Admin not found" },
                { status: 404 }
            );
        }

        const profile = result.rows[0];

        return NextResponse.json({
            success: true,
            profile: {
                id: profile.id,
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
                phone: profile.phone,
                refer_code: profile.refer_code,
                branch: profile.branch,
                city: profile.city,
                state: profile.state,
                role: profile.role,
                is_active: profile.is_active,
                created_at: profile.created_at
            }
        });

    } catch (error: any) {
        console.error("Failed to fetch Branch Admin profile:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch profile",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
