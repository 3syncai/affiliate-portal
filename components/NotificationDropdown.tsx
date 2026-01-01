"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Bell, X, CheckCircle, AlertCircle, DollarSign, Info } from "lucide-react"

type Notification = {
    id: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    sender_role?: string
}

type NotificationDropdownProps = {
    userId: string
    userRole: string
}

export default function NotificationDropdown({ userId, userRole }: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (userId) {
            fetchNotifications()
        }
    }, [userId])

    const fetchNotifications = async () => {
        try {
            const response = await axios.get(`/api/notifications?recipientId=${userId}&recipientRole=${userRole}`)
            if (response.data.success) {
                setNotifications(response.data.notifications)
                setUnreadCount(response.data.unreadCount || 0)
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error)
        }
    }

    const markAsRead = async (notificationId: string) => {
        try {
            await axios.patch("/api/notifications", { notificationId })
            // Update local state
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error("Failed to mark notification as read:", error)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'payment':
                return <DollarSign className="w-5 h-5 text-green-600" />
            case 'alert':
                return <AlertCircle className="w-5 h-5 text-red-600" />
            case 'system':
                return <Info className="w-5 h-5 text-blue-600" />
            default:
                return <CheckCircle className="w-5 h-5 text-gray-600" />
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return 'just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Panel */}
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-40 max-h-[500px] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                                {unreadCount > 0 && (
                                    <p className="text-sm text-gray-500">{unreadCount} unread</p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto flex-1">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No notifications yet</p>
                                    <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {notifications.map((notification) => (
                                        <button
                                            key={notification.id}
                                            onClick={() => {
                                                if (!notification.is_read) {
                                                    markAsRead(notification.id)
                                                }
                                            }}
                                            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${!notification.is_read ? 'bg-blue-50' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0 mt-1">
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500">
                                                            {formatTime(notification.created_at)}
                                                        </span>
                                                        {!notification.is_read && (
                                                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer - Mark all as read */}
                        {unreadCount > 0 && (
                            <div className="p-3 border-t border-gray-200">
                                <button
                                    onClick={async () => {
                                        // Mark all as read
                                        const unreadNotifications = notifications.filter(n => !n.is_read)
                                        for (const notif of unreadNotifications) {
                                            await markAsRead(notif.id)
                                        }
                                    }}
                                    className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-700 py-2 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
