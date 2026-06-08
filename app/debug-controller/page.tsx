"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Database,
    Eye,
    EyeOff,
    Loader2,
    LogOut,
    MousePointer2,
    RefreshCw,
    Server,
    Shield,
    Skull,
    Terminal,
    Trash2,
    XCircle,
} from "lucide-react"

axios.defaults.withCredentials = true

type Tab = "overview" | "logs" | "activities" | "database"
type LogFilter = "all" | "client" | "server"

interface Overview {
    status: string
    uptimeSeconds: number
    nodeVersion: string
    platform: string
    env: string
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number }
    database: { status: string; latencyMs: number; error: string | null }
    logs: {
        total: number
        counts: { error: number; warn: number; info: number; request: number }
    }
    envCheck: { key: string; status: string; preview: string }[]
    responseMs: number
    timestamp: string
}

interface DebugLogEntry {
    id: string
    level: "error" | "warn" | "info" | "request"
    message: string
    source?: string
    stack?: string
    meta?: Record<string, unknown>
    timestamp: string
}

interface ActivityEntry {
    id: number
    activity_type: string
    actor_name: string
    actor_role: string
    description: string
    amount: string | null
    created_at: string
}

interface AffiliateTableRow {
    table: string
    label: string
    group: string
    protected?: boolean
    count: number | null
    exists: boolean
    error?: string
}

interface TablePreview {
    table: string
    count: number
    columns: { column_name: string; data_type: string }[]
    rows: Record<string, unknown>[]
}

const TRUNCATE_ALL_CONFIRM = "DELETE ALL AFFILIATE DATA"

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

function StatusBadge({ status }: { status: string }) {
    const ok = status === "ok" || status === "healthy" || status === "set"
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                ok
                    ? "bg-emerald-500/15 text-emerald-400"
                    : status === "missing"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400"
            }`}
        >
            {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {status}
        </span>
    )
}

function LogLevelBadge({ level }: { level: DebugLogEntry["level"] }) {
    const colors = {
        error: "bg-red-500/20 text-red-400 border-red-500/30",
        warn: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        request: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    }
    return (
        <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[level]}`}
        >
            {level}
        </span>
    )
}

export default function DebugControllerPage() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null)
    const [loginId, setLoginId] = useState("")
    const [loginPassword, setLoginPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loginError, setLoginError] = useState("")
    const [loginLoading, setLoginLoading] = useState(false)

    const [activeTab, setActiveTab] = useState<Tab>("overview")
    const [overview, setOverview] = useState<Overview | null>(null)
    const [logs, setLogs] = useState<DebugLogEntry[]>([])
    const [activities, setActivities] = useState<ActivityEntry[]>([])
    const [dbStats, setDbStats] = useState<any>(null)
    const [affiliateTables, setAffiliateTables] = useState<AffiliateTableRow[]>([])
    const [totalTableRows, setTotalTableRows] = useState(0)
    const [expandedTable, setExpandedTable] = useState<string | null>(null)
    const [tablePreview, setTablePreview] = useState<TablePreview | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{
        table: string
        label: string
        count: number | null
        bulk?: boolean
    } | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState("")
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteMessage, setDeleteMessage] = useState("")
    const [loading, setLoading] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [expandedLog, setExpandedLog] = useState<string | null>(null)
    const [rightClickEnabled, setRightClickEnabled] = useState(true)
    const [rightClickLoading, setRightClickLoading] = useState(false)
    const [logFilter, setLogFilter] = useState<LogFilter>("all")

    const checkAuth = useCallback(async () => {
        try {
            const res = await axios.get("/api/debug-controller/verify")
            setAuthenticated(res.data.authenticated === true)
        } catch {
            setAuthenticated(false)
        }
    }, [])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const tab = params.get("tab") as Tab | null
        const filter = params.get("filter") as LogFilter | null
        if (
            tab === "overview" ||
            tab === "logs" ||
            tab === "activities" ||
            tab === "database"
        ) {
            setActiveTab(tab)
        }
        if (filter === "client" || filter === "server" || filter === "all") {
            setLogFilter(filter)
        }
    }, [])

    const fetchOverview = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/overview")
        setOverview(res.data.overview)
    }, [])

    const fetchLogs = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/logs?limit=200")
        setLogs(res.data.logs)
    }, [])

    const fetchActivities = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/activities?limit=80")
        setActivities(res.data.activities ?? [])
    }, [])

    const fetchDbStats = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/db-stats")
        setDbStats(res.data)
    }, [])

    const fetchAffiliateTables = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/tables")
        setAffiliateTables(res.data.tables ?? [])
        setTotalTableRows(res.data.totalRows ?? 0)
    }, [])

    const fetchRightClick = useCallback(async () => {
        const res = await axios.get("/api/debug-controller/right-click")
        setRightClickEnabled(res.data.rightClickEnabled !== false)
    }, [])

    const fetchTablePreview = useCallback(async (table: string) => {
        setPreviewLoading(true)
        try {
            const res = await axios.get(
                `/api/debug-controller/tables?preview=${encodeURIComponent(table)}&limit=15`
            )
            setTablePreview(res.data)
        } catch {
            setTablePreview(null)
        } finally {
            setPreviewLoading(false)
        }
    }, [])

    const refreshAll = useCallback(async () => {
        if (!authenticated) return
        setLoading(true)
        try {
            await Promise.all([
                fetchOverview(),
                fetchLogs(),
                fetchActivities(),
                fetchDbStats(),
                fetchAffiliateTables(),
                fetchRightClick(),
            ])
        } catch (err) {
            console.error("Refresh failed:", err)
        } finally {
            setLoading(false)
        }
    }, [
        authenticated,
        fetchOverview,
        fetchLogs,
        fetchActivities,
        fetchDbStats,
        fetchAffiliateTables,
        fetchRightClick,
    ])

    useEffect(() => {
        if (authenticated) {
            refreshAll()
        }
    }, [authenticated, refreshAll])

    useEffect(() => {
        if (!authenticated || !autoRefresh) return
        const interval = setInterval(refreshAll, 10000)
        return () => clearInterval(interval)
    }, [authenticated, autoRefresh, refreshAll])

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault()
        setLoginError("")
        setLoginLoading(true)
        try {
            await axios.post("/api/debug-controller/login", {
                id: loginId,
                password: loginPassword,
            })
            setAuthenticated(true)
            setLoginPassword("")
        } catch (err: any) {
            setLoginError(
                err.response?.data?.message ?? "Login failed. Check credentials."
            )
        } finally {
            setLoginLoading(false)
        }
    }

    const handleLogout = async () => {
        await axios.post("/api/debug-controller/logout")
        setAuthenticated(false)
        setOverview(null)
        setLogs([])
        setActivities([])
        setDbStats(null)
    }

    const handleClearLogs = async () => {
        await axios.delete("/api/debug-controller/logs")
        await fetchLogs()
        await fetchOverview()
    }

    const handleToggleRightClick = async () => {
        setRightClickLoading(true)
        try {
            const res = await axios.post("/api/debug-controller/right-click", {
                toggle: true,
            })
            setRightClickEnabled(res.data.rightClickEnabled !== false)
        } catch (err) {
            console.error("Right-click toggle failed:", err)
        } finally {
            setRightClickLoading(false)
        }
    }

    const toggleTableExpand = async (table: string) => {
        if (expandedTable === table) {
            setExpandedTable(null)
            setTablePreview(null)
            return
        }
        setExpandedTable(table)
        await fetchTablePreview(table)
    }

    const handleDeleteTable = async () => {
        if (!deleteTarget) return
        setDeleteLoading(true)
        setDeleteMessage("")
        try {
            const payload = deleteTarget.bulk
                ? { action: "truncate_all", confirmText: deleteConfirm }
                : { table: deleteTarget.table, confirmText: deleteConfirm }

            const res = await axios.delete("/api/debug-controller/tables", {
                data: payload,
            })

            setDeleteMessage(res.data.message ?? "Done")
            setDeleteTarget(null)
            setDeleteConfirm("")
            setExpandedTable(null)
            setTablePreview(null)
            await fetchAffiliateTables()
            await fetchDbStats()
        } catch (err: any) {
            setDeleteMessage(
                err.response?.data?.message ?? "Delete failed"
            )
        } finally {
            setDeleteLoading(false)
        }
    }

    const filteredLogs = useMemo(() => {
        if (logFilter === "all") return logs
        if (logFilter === "client") {
            return logs.filter(
                (l) => l.source === "client" || l.meta?.client === true
            )
        }
        return logs.filter(
            (l) => l.source !== "client" && l.meta?.client !== true
        )
    }, [logs, logFilter])

    const clientErrorCount = useMemo(
        () =>
            logs.filter(
                (l) => l.source === "client" || l.meta?.client === true
            ).length,
        [logs]
    )

    const groupLabels: Record<string, string> = {
        users: "Users & Admins",
        transactions: "Transactions & Commissions",
        logs: "Logs",
        config: "Configuration",
    }

    if (authenticated === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
        )
    }

    if (!authenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-8 shadow-2xl">
                    <div className="mb-8 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10">
                            <Shield className="h-7 w-7 text-violet-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white">
                            Debug Controller
                        </h1>
                        <p className="mt-2 text-sm text-gray-400">
                            Developer access only. Enter your controller ID and
                            password.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                                Controller ID
                            </label>
                            <input
                                type="text"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                                placeholder="Enter ID"
                                autoComplete="username"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={loginPassword}
                                    onChange={(e) =>
                                        setLoginPassword(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 pr-12 text-white placeholder-gray-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                                    placeholder="Enter password"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {loginError && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
                        >
                            {loginLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Terminal className="h-5 w-5" />
                                    Access Controller
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    const tabs: { id: Tab; label: string; icon: typeof Server }[] = [
        { id: "overview", label: "Overview", icon: Server },
        { id: "logs", label: "Error Logs", icon: Terminal },
        { id: "activities", label: "Activity Log", icon: Activity },
        { id: "database", label: "Database", icon: Database },
    ]

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
            <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15">
                            <Shield className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">
                                Debug Controller
                            </h1>
                            <p className="text-xs text-gray-500">
                                Affiliate Portal Dev Monitor
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) =>
                                    setAutoRefresh(e.target.checked)
                                }
                                className="rounded border-white/20"
                            />
                            Auto-refresh (10s)
                        </label>
                        <button
                            onClick={refreshAll}
                            disabled={loading}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                            />
                            Refresh
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                </div>
                <nav className="mx-auto flex max-w-7xl gap-1 px-4 pb-0">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                                activeTab === id
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-gray-500 hover:text-gray-300"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                            {id === "logs" &&
                                (overview?.logs.counts.error ?? 0) +
                                    clientErrorCount >
                                    0 && (
                                    <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] text-red-400">
                                        {(overview?.logs.counts.error ?? 0) +
                                            clientErrorCount}
                                    </span>
                                )}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6">
                {activeTab === "overview" && overview && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                            <div className="flex items-center gap-4">
                                <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                                        rightClickEnabled
                                            ? "bg-emerald-500/15"
                                            : "bg-red-500/15"
                                    }`}
                                >
                                    <MousePointer2
                                        className={`h-6 w-6 ${
                                            rightClickEnabled
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">
                                        Right-Click Site-Wide
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        {rightClickEnabled
                                            ? "Users can right-click across the portal"
                                            : "Right-click is blocked for all users"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleRightClick}
                                disabled={rightClickLoading}
                                className={`flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition disabled:opacity-50 ${
                                    rightClickEnabled
                                        ? "bg-red-600 text-white hover:bg-red-500"
                                        : "bg-emerald-600 text-white hover:bg-emerald-500"
                                }`}
                            >
                                {rightClickLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : rightClickEnabled ? (
                                    "Turn OFF"
                                ) : (
                                    "Turn ON"
                                )}
                            </button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                label="System Status"
                                value={overview.status}
                                icon={Server}
                                accent={
                                    overview.status === "healthy"
                                        ? "emerald"
                                        : "red"
                                }
                            />
                            <StatCard
                                label="Uptime"
                                value={formatUptime(overview.uptimeSeconds)}
                                icon={Activity}
                                accent="violet"
                            />
                            <StatCard
                                label="DB Latency"
                                value={`${overview.database.latencyMs}ms`}
                                icon={Database}
                                accent={
                                    overview.database.status === "ok"
                                        ? "emerald"
                                        : "red"
                                }
                            />
                            <StatCard
                                label="Errors Captured"
                                value={String(overview.logs.counts.error)}
                                icon={AlertTriangle}
                                accent={
                                    overview.logs.counts.error > 0
                                        ? "red"
                                        : "emerald"
                                }
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Panel title="Runtime">
                                <dl className="space-y-2 text-sm">
                                    <Row
                                        label="Node"
                                        value={overview.nodeVersion}
                                    />
                                    <Row
                                        label="Platform"
                                        value={overview.platform}
                                    />
                                    <Row label="Environment" value={overview.env} />
                                    <Row
                                        label="Memory (RSS)"
                                        value={`${overview.memory.rssMb} MB`}
                                    />
                                    <Row
                                        label="Heap Used"
                                        value={`${overview.memory.heapUsedMb} / ${overview.memory.heapTotalMb} MB`}
                                    />
                                    <Row
                                        label="Last Check"
                                        value={new Date(
                                            overview.timestamp
                                        ).toLocaleString("en-IN")}
                                    />
                                </dl>
                            </Panel>

                            <Panel title="Log Summary">
                                <dl className="space-y-2 text-sm">
                                    <Row
                                        label="Total Entries"
                                        value={String(overview.logs.total)}
                                    />
                                    <Row
                                        label="Errors"
                                        value={String(
                                            overview.logs.counts.error
                                        )}
                                    />
                                    <Row
                                        label="Warnings"
                                        value={String(
                                            overview.logs.counts.warn
                                        )}
                                    />
                                    <Row
                                        label="Info"
                                        value={String(
                                            overview.logs.counts.info
                                        )}
                                    />
                                    {overview.database.error && (
                                        <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                                            DB Error: {overview.database.error}
                                        </div>
                                    )}
                                </dl>
                            </Panel>
                        </div>

                        <Panel title="Environment Variables">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="pb-2 pr-4">Key</th>
                                            <th className="pb-2 pr-4">Status</th>
                                            <th className="pb-2">Preview</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview.envCheck.map((item) => (
                                            <tr
                                                key={item.key}
                                                className="border-b border-white/5"
                                            >
                                                <td className="py-2 pr-4 font-mono text-xs text-gray-300">
                                                    {item.key}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <StatusBadge
                                                        status={item.status}
                                                    />
                                                </td>
                                                <td className="py-2 font-mono text-xs text-gray-500">
                                                    {item.preview}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    </div>
                )}

                {activeTab === "logs" && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        ["all", "All"],
                                        ["client", "Client / Browser"],
                                        ["server", "Server"],
                                    ] as const
                                ).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setLogFilter(key)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                            logFilter === key
                                                ? "bg-violet-600 text-white"
                                                : "border border-white/10 text-gray-400 hover:bg-white/5"
                                        }`}
                                    >
                                        {label}
                                        {key === "client" &&
                                            clientErrorCount > 0 &&
                                            ` (${clientErrorCount})`}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleClearLogs}
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear Logs
                            </button>
                        </div>
                        <p className="text-sm text-gray-400">
                            Client errors from the browser (404 resources, JS
                            crashes) and server-side logs (last 500 entries)
                        </p>
                        <div className="space-y-2">
                            {filteredLogs.length === 0 ? (
                                <div className="rounded-xl border border-white/10 bg-[#12121a] p-12 text-center text-gray-500">
                                    {logFilter === "client"
                                        ? "No client errors captured yet"
                                        : "No logs captured yet"}
                                </div>
                            ) : (
                                filteredLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`rounded-lg border p-4 ${
                                            log.source === "client" ||
                                            log.meta?.client === true
                                                ? "border-red-500/30 bg-red-500/5"
                                                : "border-white/10 bg-[#12121a]"
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <LogLevelBadge level={log.level} />
                                            {(log.source === "client" ||
                                                log.meta?.client === true) && (
                                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-400">
                                                    Browser
                                                </span>
                                            )}
                                            {log.source && (
                                                <span className="text-xs text-gray-500">
                                                    {log.source}
                                                </span>
                                            )}
                                            <span className="ml-auto text-xs text-gray-600">
                                                {new Date(
                                                    log.timestamp
                                                ).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                        <p className="mt-2 font-mono text-sm text-gray-200">
                                            {log.message}
                                        </p>
                                        {typeof log.meta?.page === "string" && (
                                            <p className="mt-1 truncate text-xs text-gray-500">
                                                Page: {log.meta.page}
                                            </p>
                                        )}
                                        {typeof log.meta?.url === "string" && (
                                            <p className="mt-0.5 truncate text-xs text-gray-500">
                                                Resource: {log.meta.url}
                                            </p>
                                        )}
                                        {log.stack && (
                                            <button
                                                onClick={() =>
                                                    setExpandedLog(
                                                        expandedLog === log.id
                                                            ? null
                                                            : log.id
                                                    )
                                                }
                                                className="mt-2 text-xs text-violet-400 hover:underline"
                                            >
                                                {expandedLog === log.id
                                                    ? "Hide stack"
                                                    : "Show stack trace"}
                                            </button>
                                        )}
                                        {expandedLog === log.id && log.stack && (
                                            <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-red-300/80">
                                                {log.stack}
                                            </pre>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "activities" && (
                    <Panel title="Recent System Activity">
                        {activities.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                No activity log entries found
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {activities.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex flex-wrap items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3 text-sm"
                                    >
                                        <span className="rounded bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
                                            {a.activity_type}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-gray-200">
                                                {a.description}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {a.actor_name} ({a.actor_role})
                                                {a.amount &&
                                                    ` · ₹${a.amount}`}
                                            </p>
                                        </div>
                                        <span className="text-xs text-gray-600">
                                            {new Date(
                                                a.created_at
                                            ).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                )}

                {activeTab === "database" && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                            <div>
                                <p className="font-medium text-red-400">
                                    Affiliate Database Control
                                </p>
                                <p className="text-sm text-gray-400">
                                    {affiliateTables.length} tables ·{" "}
                                    {totalTableRows.toLocaleString()} total rows
                                </p>
                            </div>
                            <button
                                onClick={() =>
                                    setDeleteTarget({
                                        table: "",
                                        label: "ALL TABLES",
                                        count: totalTableRows,
                                        bulk: true,
                                    })
                                }
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                            >
                                <Skull className="h-4 w-4" />
                                Delete All Affiliate Data
                            </button>
                        </div>

                        {(["users", "transactions", "logs", "config"] as const).map(
                            (group) => {
                                const groupTables = affiliateTables.filter(
                                    (t) => t.group === group
                                )
                                if (groupTables.length === 0) return null
                                return (
                                    <Panel
                                        key={group}
                                        title={groupLabels[group] ?? group}
                                    >
                                        <div className="space-y-2">
                                            {groupTables.map((t) => (
                                                <div
                                                    key={t.table}
                                                    className="rounded-lg border border-white/10 bg-black/20"
                                                >
                                                    <div className="flex flex-wrap items-center gap-3 p-4">
                                                        <button
                                                            onClick={() =>
                                                                toggleTableExpand(
                                                                    t.table
                                                                )
                                                            }
                                                            className="flex items-center gap-2 text-left"
                                                        >
                                                            {expandedTable ===
                                                            t.table ? (
                                                                <ChevronDown className="h-4 w-4 text-gray-500" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4 text-gray-500" />
                                                            )}
                                                            <div>
                                                                <p className="font-medium text-white">
                                                                    {t.label}
                                                                    {t.protected && (
                                                                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                                                                            PROTECTED
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="font-mono text-xs text-gray-500">
                                                                    {t.table}
                                                                </p>
                                                            </div>
                                                        </button>
                                                        <div className="ml-auto flex items-center gap-3">
                                                            {t.error ? (
                                                                <span className="text-xs text-red-400">
                                                                    {t.error}
                                                                </span>
                                                            ) : (
                                                                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm font-bold text-violet-400">
                                                                    {(
                                                                        t.count ?? 0
                                                                    ).toLocaleString()}{" "}
                                                                    rows
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() =>
                                                                    setDeleteTarget(
                                                                        {
                                                                            table: t.table,
                                                                            label: t.label,
                                                                            count: t.count,
                                                                        }
                                                                    )
                                                                }
                                                                disabled={
                                                                    !t.exists
                                                                }
                                                                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Delete Table
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {expandedTable === t.table && (
                                                        <div className="border-t border-white/10 p-4">
                                                            {previewLoading ? (
                                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Loading preview…
                                                                </div>
                                                            ) : tablePreview?.table ===
                                                              t.table ? (
                                                                <div className="overflow-x-auto">
                                                                    {tablePreview
                                                                        .rows
                                                                        .length ===
                                                                    0 ? (
                                                                        <p className="text-sm text-gray-500">
                                                                            Table is
                                                                            empty
                                                                        </p>
                                                                    ) : (
                                                                        <table className="w-full text-xs">
                                                                            <thead>
                                                                                <tr className="border-b border-white/10 text-left text-gray-500">
                                                                                    {tablePreview.columns
                                                                                        .slice(
                                                                                            0,
                                                                                            8
                                                                                        )
                                                                                        .map(
                                                                                            (
                                                                                                col
                                                                                            ) => (
                                                                                                <th
                                                                                                    key={
                                                                                                        col.column_name
                                                                                                    }
                                                                                                    className="pb-2 pr-3 font-mono"
                                                                                                >
                                                                                                    {
                                                                                                        col.column_name
                                                                                                    }
                                                                                                </th>
                                                                                            )
                                                                                        )}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {tablePreview.rows.map(
                                                                                    (
                                                                                        row,
                                                                                        i
                                                                                    ) => (
                                                                                        <tr
                                                                                            key={
                                                                                                i
                                                                                            }
                                                                                            className="border-b border-white/5"
                                                                                        >
                                                                                            {tablePreview.columns
                                                                                                .slice(
                                                                                                    0,
                                                                                                    8
                                                                                                )
                                                                                                .map(
                                                                                                    (
                                                                                                        col
                                                                                                    ) => (
                                                                                                        <td
                                                                                                            key={
                                                                                                                col.column_name
                                                                                                            }
                                                                                                            className="max-w-[200px] truncate py-2 pr-3 font-mono text-gray-300"
                                                                                                            title={String(
                                                                                                                row[
                                                                                                                    col
                                                                                                                        .column_name
                                                                                                                ] ??
                                                                                                                    ""
                                                                                                            )}
                                                                                                        >
                                                                                                            {formatCell(
                                                                                                                row[
                                                                                                                    col
                                                                                                                        .column_name
                                                                                                                ]
                                                                                                            )}
                                                                                                        </td>
                                                                                                    )
                                                                                                )}
                                                                                        </tr>
                                                                                    )
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                    <p className="mt-2 text-xs text-gray-600">
                                                                        Showing up
                                                                        to 15 rows ·
                                                                        total{" "}
                                                                        {tablePreview.count.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </Panel>
                                )
                            }
                        )}

                        {dbStats && (
                            <>
                                {dbStats.affiliateBreakdown && (
                                    <Panel title="Affiliate Breakdown">
                                        <dl className="space-y-2 text-sm">
                                            <Row
                                                label="Inactive"
                                                value={String(
                                                    dbStats.affiliateBreakdown
                                                        .inactive ?? 0
                                                )}
                                            />
                                            <Row
                                                label="Pending Approval"
                                                value={String(
                                                    dbStats.affiliateBreakdown
                                                        .pending ?? 0
                                                )}
                                            />
                                        </dl>
                                    </Panel>
                                )}

                                {dbStats.withdrawalByStatus?.length > 0 && (
                                    <Panel title="Withdrawals by Status">
                                        <dl className="space-y-2 text-sm">
                                            {dbStats.withdrawalByStatus.map(
                                                (w: {
                                                    status: string
                                                    count: number
                                                }) => (
                                                    <Row
                                                        key={w.status}
                                                        label={w.status}
                                                        value={String(w.count)}
                                                    />
                                                )
                                            )}
                                        </dl>
                                    </Panel>
                                )}
                            </>
                        )}
                    </div>
                )}

                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#12121a] p-6 shadow-2xl">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
                                    <Skull className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">
                                        {deleteTarget.bulk
                                            ? "Delete ALL Affiliate Data"
                                            : `Delete ${deleteTarget.label}`}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        {deleteTarget.bulk
                                            ? `This will truncate all ${affiliateTables.length} affiliate tables`
                                            : `Permanently delete all ${(deleteTarget.count ?? 0).toLocaleString()} rows from ${deleteTarget.table}`}
                                    </p>
                                </div>
                            </div>

                            <p className="mb-3 text-sm text-red-400">
                                This action cannot be undone. Type{" "}
                                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
                                    {deleteTarget.bulk
                                        ? TRUNCATE_ALL_CONFIRM
                                        : deleteTarget.table}
                                </code>{" "}
                                to confirm.
                            </p>

                            <input
                                type="text"
                                value={deleteConfirm}
                                onChange={(e) =>
                                    setDeleteConfirm(e.target.value)
                                }
                                className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white outline-none focus:border-red-500/50"
                                placeholder="Type confirmation text"
                                autoFocus
                            />

                            {deleteMessage && (
                                <p className="mb-3 text-sm text-amber-400">
                                    {deleteMessage}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDeleteTarget(null)
                                        setDeleteConfirm("")
                                        setDeleteMessage("")
                                    }}
                                    className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteTable}
                                    disabled={
                                        deleteLoading ||
                                        deleteConfirm !==
                                            (deleteTarget.bulk
                                                ? TRUNCATE_ALL_CONFIRM
                                                : deleteTarget.table)
                                    }
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                                >
                                    {deleteLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            Delete Forever
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

function StatCard({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string
    value: string
    icon: typeof Server
    accent: "emerald" | "red" | "violet"
}) {
    const accentColors = {
        emerald: "text-emerald-400 bg-emerald-500/10",
        red: "text-red-400 bg-red-500/10",
        violet: "text-violet-400 bg-violet-500/10",
    }
    return (
        <div className="rounded-xl border border-white/10 bg-[#12121a] p-5">
            <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                    {label}
                </span>
                <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentColors[accent]}`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="mt-3 text-2xl font-bold capitalize text-white">
                {value}
            </p>
        </div>
    )
}

function Panel({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#12121a] p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                {title}
            </h2>
            {children}
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-mono text-gray-200">{value}</dd>
        </div>
    )
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "object") {
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }
    const str = String(value)
    return str.length > 60 ? `${str.slice(0, 60)}…` : str
}
