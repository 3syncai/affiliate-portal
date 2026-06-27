"use client"

import { useEffect, useState } from "react"
import { Clock, Undo2, AlertCircle } from "lucide-react"

type Props = {
  status: string
  unlockAt?: string | null
  hasReturn?: boolean
  returnRequestPending?: boolean
  className?: string
}

const formatRemaining = (msRemaining: number) => {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000))
  if (totalSeconds >= 3600) {
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    return `${hours}h ${minutes}m`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export default function CommissionStatusBadge({
  status,
  unlockAt,
  hasReturn,
  returnRequestPending,
  className = "",
}: Props) {
  const unlockTime = unlockAt ? new Date(unlockAt).getTime() : null
  const [now, setNow] = useState(() => Date.now())

  const isAwaitingUnlock =
    !hasReturn &&
    !returnRequestPending &&
    status === "PENDING" &&
    unlockTime !== null &&
    unlockTime > now

  useEffect(() => {
    if (!isAwaitingUnlock) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isAwaitingUnlock])

  if (hasReturn) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 ${className}`}
        title="Return approved — commission voided"
      >
        <Undo2 className="w-3 h-3" />
        RETURNED
      </span>
    )
  }

  if (returnRequestPending && status === "PENDING") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800 ${className}`}
        title="Customer return/refund requested — commission on hold"
      >
        <AlertCircle className="w-3 h-3" />
        Return requested
      </span>
    )
  }

  if (isAwaitingUnlock && unlockTime !== null) {
    const remaining = unlockTime - now
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 ${className}`}
        title="Crediting after 7-day return window"
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
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 ${className}`}
        title="Commission pending until order is delivered"
      >
        Pending until delivery
      </span>
    )
  }

  if (status === "CANCELLED") {
    return (
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 ${className}`}
        title="Order cancelled or refunded — no commission"
      >
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
