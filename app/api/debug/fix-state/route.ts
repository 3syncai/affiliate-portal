import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { userId, correctState } = await req.json();

        if (!userId || !correctState) {
            return NextResponse.json({
                success: false,
                error: "userId and correctState required"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Update the user's state
        const updateQuery = `
            UPDATE affiliate_user 
            SET state = $1 
            WHERE id = $2
            RETURNING id, first_name, last_name, state
        `;

        const result = await pool.query(updateQuery, [correctState, userId]);

        await pool.end();

        return NextResponse.json({
            success: true,
            updatedUser: result.rows[0],
            message: `State updated to ${correctState}`
        });

    } catch (error: any) {
        console.error("Failed to fix state:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
