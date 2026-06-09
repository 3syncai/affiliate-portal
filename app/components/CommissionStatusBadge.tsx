"use client"

import { useEffect, useState } from "react"
import { Clock, Undo2 } from "lucide-react"

type Props = {
  status: string
  unlockAt?: string | null
  hasReturn?: boolean
  className?: string
}

const formatRemaining = (msRemaining: number) => {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Renders the commission status. While a delivered commission is waiting out
 * the post-delivery unlock window, a live countdown is shown instead of the
 * raw "PENDING" badge so the affiliate can see exactly when the money will
 * land in their wallet. Once an admin approves a customer return (even
 * mid-countdown), the badge switches to "RETURNED" and the commission is
 * zeroed while the timer stops.
 */
export default function CommissionStatusBadge({
  status,
  unlockAt,
  hasReturn,
  className = "",
}: Props) {
  const unlockTime = unlockAt ? new Date(unlockAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())

  const isAwaitingUnlock =
    !hasReturn && status === "PENDING" && unlockTime !== null && unlockTime > now

  useEffect(() => {
    if (!isAwaitingUnlock) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isAwaitingUnlock])

  // A return always wins, even over CREDITED/PENDING badges, because the
  // sync immediately zeroes affiliate_commission on the row.
  if (hasReturn) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 ${className}`}
        title="Customer returned this product — no commission credited"
      >
        <Undo2 className="w-3 h-3" />
        RETURNED
      </span>
    )
  }

  if (isAwaitingUnlock && unlockTime !== null) {
    const remaining = unlockTime - now
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 ${className}`}
        title="Crediting to wallet shortly"
      >
        <Clock className="w-3 h-3" />
        Crediting in {formatRemaining(remaining)}
      </span>
    )
  }

  if (status === "CREDITED") {
    return (
      <span className={`inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 ${className}`}>
        CREDITED
      </span>
    )
  }

  if (status === "PENDING") {
    return (
      <span className={`inline-block text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 ${className}`}>
        PENDING
      </span>
    )
  }

  if (status === "CANCELLED") {
    return (
      <span className={`inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 ${className}`}>
        CANCELLED
      </span>
    )
  }

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 ${className}`}>
      {status}
    </span>
  )
}
