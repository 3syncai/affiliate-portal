import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Toggling State Admin Status ===");

    try {
        const body = await req.json();
        const { adminId, isActive } = body;

        if (!adminId) {
            return NextResponse.json(
                { success: false, message: "Admin ID is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `UPDATE state_admin SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_active`,
            [isActive, adminId]
        );

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "State admin not found" },
                { status: 404 }
            );
        }

        console.log(`State admin ${adminId} status updated to ${isActive}`);

        return NextResponse.json({
            success: true,
            message: `State admin ${isActive ? 'activated' : 'deactivated'} successfully`,
            admin: result.rows[0]
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to toggle state admin status:", err);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to update status",
                error: err.message
            },
            { status: 500 }
        );
    }
}
