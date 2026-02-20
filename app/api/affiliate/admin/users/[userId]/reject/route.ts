import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    console.log(`=== Rejecting User: ${userId} ===`);

    try {
        const body = await request.json();
        const { rejection_reason } = body;

        if (!rejection_reason) {
            return NextResponse.json(
                { success: false, error: "Rejection reason is required" },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Update user - set is_approved to false (keeping them in rejected state)
        const updateQuery = `
            UPDATE affiliate_user 
            SET is_approved = false,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, email, first_name, last_name, is_approved
        `;

        const result = await pool.query(updateQuery, [userId]);

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }


        console.log(`User ${userId} rejected successfully with reason: ${rejection_reason}`);
        return NextResponse.json({
            success: true,
            message: "User rejected successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to reject user:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to reject user",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
