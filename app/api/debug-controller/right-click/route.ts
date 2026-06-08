import { NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/debug-controller-auth"
import {
    isRightClickEnabled,
    setRightClickEnabled,
    toggleRightClick,
} from "@/lib/site-settings"
import { addDebugLog } from "@/lib/debug-monitor"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const enabled = await isRightClickEnabled()
    return NextResponse.json({ success: true, rightClickEnabled: enabled })
}

export async function POST(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    let body: { enabled?: boolean; toggle?: boolean } = {}
    try {
        body = await req.json()
    } catch {
        // empty body → toggle
    }

    let enabled: boolean
    if (typeof body.enabled === "boolean") {
        enabled = await setRightClickEnabled(body.enabled)
    } else {
        enabled = await toggleRightClick()
    }

    addDebugLog("info", `Right-click ${enabled ? "enabled" : "disabled"} site-wide`, {
        source: "debug-controller/right-click",
    })

    return NextResponse.json({
        success: true,
        rightClickEnabled: enabled,
        message: enabled
            ? "Right-click is now ON for all users"
            : "Right-click is now OFF for all users",
    })
}
