"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, X } from "lucide-react"

const SESSION_KEY = "affiliate_client_error_count"

function reportClientError(payload: {
    message: string
    stack?: string
    url?: string
    page: string
    type: string
    meta?: Record<string, unknown>
}) {
    fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
    }).catch(() => {})
}

export default function ClientErrorReporter() {
    const pathname = usePathname()
    const [errorCount, setErrorCount] = useState(0)
    const [dismissed, setDismissed] = useState(false)
    const reportedRef = useRef<Set<string>>(new Set())

    const bumpError = useCallback(() => {
        setErrorCount((c) => {
            const next = c + 1
            if (typeof window !== "undefined") {
                sessionStorage.setItem(SESSION_KEY, String(next))
            }
            return next
        })
        setDismissed(false)
    }, [])

    const report = useCallback(
        (payload: {
            message: string
            stack?: string
            url?: string
            type: string
            meta?: Record<string, unknown>
        }) => {
            const key = `${payload.type}:${payload.message}`.slice(0, 200)
            if (reportedRef.current.has(key)) return
            reportedRef.current.add(key)

            reportClientError({
                ...payload,
                page:
                    typeof window !== "undefined"
                        ? window.location.href
                        : pathname ?? "",
            })
            bumpError()
        },
        [bumpError, pathname]
    )

    useEffect(() => {
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
            const n = parseInt(stored, 10)
            if (n > 0) setErrorCount(n)
        }
    }, [])

    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            if (event.target instanceof HTMLElement) {
                const el = event.target
                const src =
                    (el as HTMLImageElement).src ||
                    (el as HTMLScriptElement).src ||
                    (el as HTMLLinkElement).href ||
                    "unknown resource"
                report({
                    message: `Failed to load resource: ${src}`,
                    url: src,
                    type: "resource",
                    meta: { tagName: el.tagName },
                })
                return
            }

            report({
                message: event.message || "Unknown JavaScript error",
                stack: event.error?.stack,
                url: event.filename,
                type: "error",
                meta: { lineno: event.lineno, colno: event.colno },
            })
        }

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason
            report({
                message:
                    reason instanceof Error
                        ? reason.message
                        : String(reason ?? "Unhandled promise rejection"),
                stack: reason instanceof Error ? reason.stack : undefined,
                type: "unhandledrejection",
            })
        }

        window.addEventListener("error", onError, true)
        window.addEventListener("unhandledrejection", onRejection)
        return () => {
            window.removeEventListener("error", onError, true)
            window.removeEventListener("unhandledrejection", onRejection)
        }
    }, [report])

    if (
        errorCount === 0 ||
        dismissed ||
        pathname?.startsWith("/debug-controller")
    ) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-sm">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-[#1a1012]/95 p-4 shadow-2xl backdrop-blur-md">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                        {errorCount === 1
                            ? "1 issue detected"
                            : `${errorCount} issues detected`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                        Errors were captured for review in the debug controller.
                    </p>
                    <Link
                        href="/debug-controller?tab=logs&filter=client"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-400 hover:text-red-300"
                    >
                        Go to controller for issues →
                    </Link>
                </div>
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="shrink-0 rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
