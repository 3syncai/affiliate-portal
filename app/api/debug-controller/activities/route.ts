import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireDebugAuth } from "@/lib/debug-controller-auth"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const limit = Math.min(
        parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
        200
    )

    try {
        const result = await pool.query(
            `SELECT id, activity_type, actor_id, actor_name, actor_role,
                    actor_branch, actor_state, target_id, target_name,
                    target_type, amount, description, created_at
             FROM activity_log
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit]
        )

        return NextResponse.json({
            success: true,
            activities: result.rows,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch activity log",
                error: message,
                activities: [],
            },
            { status: 500 }
        )
    }
}
