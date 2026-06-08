import { NextRequest, NextResponse } from "next/server"
import {
    createDebugSessionToken,
    setDebugSessionCookie,
    verifyDebugCredentials,
} from "@/lib/debug-controller-auth"
import { addDebugLog } from "@/lib/debug-monitor"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const id = typeof body.id === "string" ? body.id.trim() : ""
        const password = typeof body.password === "string" ? body.password : ""

        if (!id || !password) {
            return NextResponse.json(
                { success: false, message: "ID and password are required" },
                { status: 400 }
            )
        }

        let valid = false
        try {
            valid = verifyDebugCredentials(id, password)
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Debug controller is not configured. Set DEBUG_CONTROLLER_ID and DEBUG_CONTROLLER_PASSWORD in env.",
                },
                { status: 503 }
            )
        }

        if (!valid) {
            addDebugLog("warn", "Failed debug controller login attempt", {
                source: "debug-controller/login",
                meta: { id },
            })
            return NextResponse.json(
                { success: false, message: "Invalid credentials" },
                { status: 401 }
            )
        }

        const token = createDebugSessionToken()
        const res = NextResponse.json({ success: true })
        setDebugSessionCookie(res, token)

        addDebugLog("info", "Debug controller session started", {
            source: "debug-controller/login",
            meta: { id },
        })

        return res
    } catch (error) {
        console.error("Debug controller login error:", error)
        return NextResponse.json(
            { success: false, message: "Login failed" },
            { status: 500 }
        )
    }
}
