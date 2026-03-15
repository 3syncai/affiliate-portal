import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { adminId, isActive } = body;

        if (!adminId) {
            return NextResponse.json({ success: false, message: "Admin ID is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `UPDATE branch_admin SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_active`,
            [isActive, adminId]
        );

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "Branch Admin not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: `Branch Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
            admin: result.rows[0]
        });
    } catch (error) {
        console.error("Failed to toggle branch admin status:", error);
        return NextResponse.json({ success: false, message: "Failed to update status" }, { status: 500 });
    }
}
