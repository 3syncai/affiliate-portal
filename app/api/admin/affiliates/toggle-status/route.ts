import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    console.log("=== Toggling Affiliate Status ===");

    try {
        const body = await req.json();
        const { userId, isActive } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, message: "User ID is required" },
                { status: 400 }
            );
        }

        if (typeof isActive !== "boolean") {
            return NextResponse.json(
                { success: false, message: "isActive must be a boolean" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Defensive: ensure the column exists before update so deployments that
        // haven't yet run the migration don't error out.
        await pool.query(
            `ALTER TABLE affiliate_user ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`
        );

        const result = await pool.query(
            `UPDATE affiliate_user
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, email, is_active`,
            [isActive, userId]
        );

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Affiliate user not found" },
                { status: 404 }
            );
        }

        console.log(`Affiliate ${userId} status updated to ${isActive}`);

        return NextResponse.json({
            success: true,
            message: `User ${isActive ? "activated" : "deactivated"} successfully`,
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Failed to toggle affiliate status:", error);
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
