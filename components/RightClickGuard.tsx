"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

const POLL_MS = 8000

export default function RightClickGuard() {
    const pathname = usePathname()
    const [blocked, setBlocked] = useState(false)

    useEffect(() => {
        if (pathname?.startsWith("/debug-controller")) {
            setBlocked(false)
            return
        }

        let cancelled = false

        async function load() {
            try {
                const res = await fetch("/api/site-settings", {
                    cache: "no-store",
                })
                const data = await res.json()
                if (!cancelled) {
                    setBlocked(data.rightClickEnabled === false)
                }
            } catch {
                if (!cancelled) setBlocked(false)
            }
        }

        load()
        const interval = setInterval(load, POLL_MS)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [pathname])

    useEffect(() => {
        if (!blocked) return

        const block = (e: MouseEvent) => {
            e.preventDefault()
        }

        document.addEventListener("contextmenu", block)
        return () => document.removeEventListener("contextmenu", block)
    }, [blocked])

    return null
}
