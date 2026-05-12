"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import { Bell, CheckCircle, ChevronDown, ChevronUp, DollarSign, Info, AlertCircle, Wifi } from "lucide-react"
import { formatIST } from "@/lib/datetime"

type Notification = {
    id: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    sender_role?: string
}

type NotificationsResponse = {
    success: boolean
    notifications: Notification[]
    unreadCount: number
}

const fetcher = (url: string) => axios.get(url).then(res => res.data as NotificationsResponse)

export default function BranchNotificationsPage() {
    const searchParams = useSearchParams()
    const openId = searchParams.get("open")
    const [user, setUser] = useState<any>(null)
    const [authReady, setAuthReady] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")
        if (!userData || role !== "branch") {
            setAuthReady(true)
            return
        }
        try {
            setUser(JSON.parse(userData))
        } catch {
            // ignore
        }
        setAuthReady(true)
    }, [])

    const swrKey = user?.id
        ? `/api/notifications?recipientId=${user.id}&recipientRole=branch`
        : null

    const { data, isLoading, mutate, isValidating } = useSWR<NotificationsResponse>(swrKey, fetcher, {
        refreshInterval: 5000,
        revalidateOnFocus: true,
        keepPreviousData: true,
    })

    const notifications = data?.success ? data.notifications : []

    const markAsRead = async (notificationId: string) => {
        // Optimistic update - flip is_read locally without revalidation
        await mutate(
            (current) => current
                ? {
                    ...current,
                    notifications: current.notifications.map(n =>
                        n.id === notificationId ? { ...n, is_read: true } : n
                    ),
                    unreadCount: Math.max(0, (current.unreadCount || 0) - 1),
                }
                : current,
            { revalidate: false }
        )
        try {
            await axios.patch("/api/notifications", { notificationId })
            // Pull authoritative state
            mutate()
        } catch (error) {
            console.error("Failed to mark notification as read:", error)
            mutate() // rollback to server truth
        }
    }

    useEffect(() => {
        if (!openId) return
        setExpandedId(openId)
        const target = notifications.find(n => n.id === openId)
        if (target && !target.is_read) {
            markAsRead(openId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openId, notifications])

    const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

    const formatDateTime = (dateString: string) => formatIST(dateString)

    const getIcon = (type: string) => {
        switch (type) {
            case "payment":
                return <DollarSign className="w-5 h-5 text-green-600" />
            case "alert":
                return <AlertCircle className="w-5 h-5 text-red-600" />
            case "system":
                return <Info className="w-5 h-5 text-blue-600" />
            default:
                return <CheckCircle className="w-5 h-5 text-gray-600" />
        }
    }

    const toggleExpand = async (notification: Notification) => {
        const next = expandedId === notification.id ? null : notification.id
        setExpandedId(next)
        if (!notification.is_read) {
            await markAsRead(notification.id)
        }
    }

    if (!authReady || (swrKey && isLoading && !data)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-600">Loading notifications...</div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {notifications.length} total • {unreadCount} unread
                    </p>
                </div>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isValidating ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                    <Wifi className={`w-3.5 h-3.5 ${isValidating ? "animate-pulse" : ""}`} />
                    Live
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notifications.map((notification) => (
                            <div key={notification.id} className={`${!notification.is_read ? "bg-blue-50/40" : "bg-white"}`}>
                                <button
                                    onClick={() => toggleExpand(notification)}
                                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            {getIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className={`text-sm ${!notification.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                                                    {expandedId === notification.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{formatDateTime(notification.created_at)}</p>
                                        </div>
                                    </div>
                                </button>

                                {expandedId === notification.id && (
                                    <div className="px-4 pb-4 ml-8">
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Message</p>
                                            <p className="text-sm text-gray-700">{notification.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
