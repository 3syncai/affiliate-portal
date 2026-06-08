import { NextResponse } from "next/server"
import { clearDebugSessionCookie } from "@/lib/debug-controller-auth"
import { addDebugLog } from "@/lib/debug-monitor"

export async function POST() {
    const res = NextResponse.json({ success: true })
    clearDebugSessionCookie(res)
    addDebugLog("info", "Debug controller session ended", {
        source: "debug-controller/logout",
    })
    return res
}
