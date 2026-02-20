import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Toggling ASM Status ===");

    try {
        const body = await req.json();
        const { managerId, isActive } = body;

        if (!managerId) {
            return NextResponse.json(
                { success: false, message: "Manager ID is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `UPDATE area_sales_manager SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_active`,
            [isActive, managerId]
        );


        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Area Sales Manager not found" },
                { status: 404 }
            );
        }

        console.log(`ASM ${managerId} status updated to ${isActive}`);

        return NextResponse.json({
            success: true,
            message: `Area Sales Manager ${isActive ? 'activated' : 'deactivated'} successfully`,
            manager: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to toggle ASM status:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to update status",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
