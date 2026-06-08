import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireDebugAuth } from "@/lib/debug-controller-auth"
import { getDebugLogStats } from "@/lib/debug-monitor"

const ENV_KEYS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "DEBUG_CONTROLLER_ID",
    "DEBUG_CONTROLLER_PASSWORD",
    "MEDUSA_BACKEND_URL",
    "NEXT_PUBLIC_BACKEND_URL",
    "S3_BUCKET",
    "S3_REGION",
    "NODE_ENV",
] as const

function maskEnvValue(key: string, value: string | undefined): string {
    if (!value) return "MISSING"
    if (key.includes("SECRET") || key.includes("PASSWORD") || key.includes("URL")) {
        if (value.length <= 8) return "****"
        return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`
    }
    return value
}

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    const started = Date.now()
    let dbStatus: "ok" | "error" = "ok"
    let dbLatencyMs = 0
    let dbError: string | null = null

    try {
        const dbStart = Date.now()
        await pool.query("SELECT 1 AS ok")
        dbLatencyMs = Date.now() - dbStart
    } catch (err) {
        dbStatus = "error"
        dbError = err instanceof Error ? err.message : String(err)
    }

    const mem = process.memoryUsage()

    return NextResponse.json({
        success: true,
        overview: {
            status: dbStatus === "ok" ? "healthy" : "degraded",
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
            env: process.env.NODE_ENV ?? "unknown",
            memory: {
                rssMb: Math.round(mem.rss / 1024 / 1024),
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
            },
            database: {
                status: dbStatus,
                latencyMs: dbLatencyMs,
                error: dbError,
            },
            logs: getDebugLogStats(),
            envCheck: ENV_KEYS.map((key) => ({
                key,
                status: process.env[key] ? "set" : "missing",
                preview: maskEnvValue(key, process.env[key]),
            })),
            responseMs: Date.now() - started,
            timestamp: new Date().toISOString(),
        },
    })
}
