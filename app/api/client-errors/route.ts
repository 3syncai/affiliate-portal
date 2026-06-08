import { NextRequest, NextResponse } from "next/server"
import { addDebugLog } from "@/lib/debug-monitor"

const recentKeys = new Map<string, number>()
const DEDUPE_MS = 30_000
const MAX_BODY = 4000

function dedupeKey(message: string, url: string): string {
    return `${message.slice(0, 120)}::${url}`
}

function shouldAccept(key: string): boolean {
    const now = Date.now()
    const last = recentKeys.get(key)
    if (last && now - last < DEDUPE_MS) return false
    recentKeys.set(key, now)
    if (recentKeys.size > 500) {
        for (const [k, t] of recentKeys) {
            if (now - t > DEDUPE_MS) recentKeys.delete(k)
        }
    }
    return true
}

export async function POST(req: NextRequest) {
    try {
        const raw = await req.text()
        if (raw.length > MAX_BODY) {
            return NextResponse.json({ success: false }, { status: 413 })
        }

        let body: {
            message?: string
            stack?: string
            url?: string
            page?: string
            type?: string
            meta?: Record<string, unknown>
        }

        try {
            body = JSON.parse(raw)
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid JSON" },
                { status: 400 }
            )
        }

        const message =
            typeof body.message === "string"
                ? body.message.trim().slice(0, 2000)
                : ""
        if (!message) {
            return NextResponse.json(
                { success: false, message: "Message required" },
                { status: 400 }
            )
        }

        const page =
            typeof body.page === "string"
                ? body.page.slice(0, 500)
                : req.headers.get("referer") ?? "unknown"

        const key = dedupeKey(message, page)
        if (!shouldAccept(key)) {
            return NextResponse.json({ success: true, deduped: true })
        }

        addDebugLog("error", message, {
            source: "client",
            stack:
                typeof body.stack === "string"
                    ? body.stack.slice(0, 4000)
                    : undefined,
            meta: {
                client: true,
                type: body.type ?? "error",
                page,
                url: typeof body.url === "string" ? body.url.slice(0, 500) : undefined,
                userAgent: req.headers.get("user-agent")?.slice(0, 200),
                ...(body.meta && typeof body.meta === "object" ? body.meta : {}),
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("client-errors route failed:", error)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
