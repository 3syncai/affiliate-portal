import { NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/debug-controller-auth"
import {
    clearDebugLogs,
    getDebugLogs,
    type DebugLogLevel,
} from "@/lib/debug-monitor"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const { searchParams } = req.nextUrl
    const level = searchParams.get("level") as DebugLogLevel | null
    const limit = Math.min(
        parseInt(searchParams.get("limit") ?? "100", 10) || 100,
        500
    )
    const since = searchParams.get("since") ?? undefined

    const logs = getDebugLogs({
        level: level ?? undefined,
        limit,
        since,
    })

    return NextResponse.json({ success: true, logs })
}

export async function DELETE(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    clearDebugLogs()
    return NextResponse.json({ success: true, message: "Logs cleared" })
}
