export type DebugLogLevel = "error" | "warn" | "info" | "request"

export interface DebugLogEntry {
    id: string
    level: DebugLogLevel
    message: string
    source?: string
    stack?: string
    meta?: Record<string, unknown>
    timestamp: string
}

const MAX_ENTRIES = 500

const store: DebugLogEntry[] = []
let initialized = false
let entryCounter = 0

function nextId(): string {
    entryCounter += 1
    return `dbg_${Date.now()}_${entryCounter}`
}

export function addDebugLog(
    level: DebugLogLevel,
    message: string,
    options?: { source?: string; stack?: string; meta?: Record<string, unknown> }
): DebugLogEntry {
    const entry: DebugLogEntry = {
        id: nextId(),
        level,
        message,
        source: options?.source,
        stack: options?.stack,
        meta: options?.meta,
        timestamp: new Date().toISOString(),
    }

    store.unshift(entry)
    if (store.length > MAX_ENTRIES) {
        store.length = MAX_ENTRIES
    }

    return entry
}

export function getDebugLogs(options?: {
    level?: DebugLogLevel
    limit?: number
    since?: string
}): DebugLogEntry[] {
    const limit = options?.limit ?? 100
    let logs = [...store]

    if (options?.level) {
        logs = logs.filter((l) => l.level === options.level)
    }

    if (options?.since) {
        const sinceMs = new Date(options.since).getTime()
        logs = logs.filter((l) => new Date(l.timestamp).getTime() > sinceMs)
    }

    return logs.slice(0, limit)
}

export function clearDebugLogs(): void {
    store.length = 0
}

export function getDebugLogStats() {
    const counts = { error: 0, warn: 0, info: 0, request: 0 }
    for (const entry of store) {
        counts[entry.level] += 1
    }
    return {
        total: store.length,
        counts,
        oldest: store[store.length - 1]?.timestamp ?? null,
        newest: store[0]?.timestamp ?? null,
    }
}

export function initDebugMonitor(): void {
    if (initialized) return
    initialized = true

    const originalError = console.error.bind(console)
    const originalWarn = console.warn.bind(console)

    console.error = (...args: unknown[]) => {
        addDebugLog("error", formatArgs(args), { source: "console.error" })
        originalError(...args)
    }

    console.warn = (...args: unknown[]) => {
        addDebugLog("warn", formatArgs(args), { source: "console.warn" })
        originalWarn(...args)
    }

    process.on("uncaughtException", (err) => {
        addDebugLog("error", err.message, {
            source: "uncaughtException",
            stack: err.stack,
        })
    })

    process.on("unhandledRejection", (reason) => {
        const message =
            reason instanceof Error ? reason.message : String(reason)
        const stack = reason instanceof Error ? reason.stack : undefined
        addDebugLog("error", message, {
            source: "unhandledRejection",
            stack,
        })
    })

    addDebugLog("info", "Debug monitor initialized", { source: "debug-monitor" })
}

function formatArgs(args: unknown[]): string {
    return args
        .map((arg) => {
            if (arg instanceof Error) return `${arg.name}: ${arg.message}`
            if (typeof arg === "string") return arg
            try {
                return JSON.stringify(arg)
            } catch {
                return String(arg)
            }
        })
        .join(" ")
}
