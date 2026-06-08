import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireDebugAuth } from "@/lib/debug-controller-auth"
import { AFFILIATE_TABLES } from "@/lib/affiliate-db-tables"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const stats: {
        table: string
        label: string
        count: number | null
        error?: string
    }[] = []

    for (const { table, label } of AFFILIATE_TABLES) {
        try {
            const result = await pool.query(
                `SELECT COUNT(*)::int AS count FROM ${table}`
            )
            stats.push({
                table,
                label,
                count: result.rows[0]?.count ?? 0,
            })
        } catch (err) {
            stats.push({
                table,
                label,
                count: null,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    let recentErrors: { table: string; error: string }[] = []
    try {
        const affiliates = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE COALESCE(is_active, true) = false)::int AS inactive,
                    COUNT(*) FILTER (WHERE is_approved = false)::int AS pending
             FROM affiliate_user`
        )
        const withdrawals = await pool.query(
            `SELECT status, COUNT(*)::int AS count
             FROM withdrawal_request
             GROUP BY status
             ORDER BY count DESC`
        )

        return NextResponse.json({
            success: true,
            tableStats: stats,
            affiliateBreakdown: affiliates.rows[0] ?? {},
            withdrawalByStatus: withdrawals.rows,
            recentErrors,
        })
    } catch (err) {
        recentErrors = [
            {
                table: "breakdown",
                error: err instanceof Error ? err.message : String(err),
            },
        ]
        return NextResponse.json({
            success: true,
            tableStats: stats,
            affiliateBreakdown: {},
            withdrawalByStatus: [],
            recentErrors,
        })
    }
}
