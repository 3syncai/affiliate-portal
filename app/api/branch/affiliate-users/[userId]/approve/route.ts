import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    console.log("=== Approving Affiliate User ===");

    try {
        const { userId } = await params;

        if (!userId) {
            return NextResponse.json({ success: false, message: "User ID is required" }, { status: 400 });
        }


        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `UPDATE affiliate_user SET is_approved = true, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_approved`,
            [userId]
        );


        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        console.log(`Affiliate approved: ${result.rows[0].email}`);

        return NextResponse.json({
            success: true,
            message: "Affiliate approved successfully",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Failed to approve affiliate:", error);
        return NextResponse.json({ success: false, message: "Failed to approve affiliate" }, { status: 500 });
    }
}
