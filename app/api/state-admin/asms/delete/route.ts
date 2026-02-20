import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Delete the user
        const deleteQuery = `DELETE FROM affiliate_user WHERE id = $1 RETURNING first_name, last_name, email`;
        const result = await pool.query(deleteQuery, [userId]);

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: "User not found"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: `User ${result.rows[0].first_name} ${result.rows[0].last_name} deleted successfully`,
            deletedUser: result.rows[0]
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to delete user:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
