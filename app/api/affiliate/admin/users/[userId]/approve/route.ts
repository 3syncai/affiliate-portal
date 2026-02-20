import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    console.log(`=== Approving User: ${userId} ===`);

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Update user to approved
        const updateQuery = `
            UPDATE affiliate_user 
            SET is_approved = true, 
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


        console.log(`User ${userId} approved successfully`);
        return NextResponse.json({
            success: true,
            message: "User approved successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to approve user:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to approve user",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
