"use client"

import { useEffect, useState, useCallback } from "react"
import { Users, TrendingUp, DollarSign, ShoppingBag, CheckCircle, UserPlus, CreditCard, Clock, ArrowUpRight, MapPin, Copy, Check, Link2, TrendingDown, Share2, Wifi, WifiOff } from "lucide-react"
import axios from "axios"
import useSWR from 'swr'
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

interface Activity {
    id: string
    type: 'affiliate_request' | 'order' | 'approval' | 'withdrawal' | 'payment'
    timestamp: string
    data: {
        name: string
        action: string
        amount?: number
        order_id?: string
        product_name?: string
        commission_amount?: number
        status?: string
        transaction_id?: string
    }
}

interface User {
    id: string
    first_name: string
    last_name: string
    email: string
    refer_code: string
    branch: string
    role: string
    city?: string
    state?: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function BranchDashboard() {
    const [user, setUser] = useState<User | null>(null)
    const [copied, setCopied] = useState(false)

    // Toast notification state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData) as User
            setTimeout(() => {
                setUser(parsed)
            }, 0)
        }
    }, [])

    // SWR Hooks
    const { data: statsData, mutate: mutateStats, isLoading: statsLoading } = useSWR(
        user?.branch ? `/api/branch/stats?branch=${encodeURIComponent(user.branch)}` : null,
        fetcher
    )

    const { data: activityData, mutate: mutateActivities, isLoading: activitiesLoading } = useSWR(
        user?.branch ? `/api/branch/activity?branch=${encodeURIComponent(user.branch)}` : null,
        fetcher
    )

    const stats = statsData?.success ? statsData.stats : {
        totalAgents: 0,
        pendingApproval: 0,
        totalCommission: 0,
        totalOrders: 0
    }

    const activities: Activity[] = activityData?.success ? activityData.activities || [] : []

    const loading = statsLoading || activitiesLoading

    // Real-time updates handler
    const handleUpdate = useCallback((data: { type: string; message?: string; amount?: number }) => {
        console.log("Live update received:", data);
        if (data.type === 'stats_update' || data.type === 'payment_received') {
            setToastData({
                message: data.message || "New activity received!",
                amount: data.amount
            });
            setShowToast(true);

            // Refresh stats and activity using SWR mutate
            mutateStats();
            mutateActivities();
        }
    }, [mutateStats, mutateActivities]);

    const { isConnected } = useSSE({
        affiliateCode: user?.refer_code || '',
        onMessage: handleUpdate
    });

    const formatTimeAgo = (timestamp: string) => {
        const now = new Date()
        const date = new Date(timestamp)
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`

        const currentYear = now.getFullYear()
        const dateYear = date.getFullYear()

        if (currentYear === dateYear) {
            return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
        } else {
            return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
        }
    }

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'approval':
                return { icon: CheckCircle, bgColor: "bg-green-100", iconColor: "text-green-600" }
            case 'affiliate_request':
                return { icon: UserPlus, bgColor: "bg-orange-100", iconColor: "text-orange-600" }
            case 'order':
                return { icon: DollarSign, bgColor: "bg-blue-100", iconColor: "text-blue-600" }
            case 'withdrawal':
                return { icon: CreditCard, bgColor: "bg-purple-100", iconColor: "text-purple-600" }
            case 'payment':
                return { icon: CreditCard, bgColor: "bg-emerald-100", iconColor: "text-emerald-600" }
            default:
                return { icon: Clock, bgColor: "bg-gray-100", iconColor: "text-gray-600" }
        }
    }

    const copyReferralCode = async () => {
        if (user?.refer_code) {
            await navigator.clipboard.writeText(user.refer_code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const statCards: { title: string; value: string | number; icon: React.ElementType; color: string; bg: string }[] = [
        { title: "Total Partners", value: stats.totalAgents, icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
        { title: "Pending Approval", value: stats.pendingApproval, icon: TrendingUp, color: "text-yellow-600", bg: "bg-yellow-50" },
        { title: "Total Commission", value: `₹${stats.totalCommission.toLocaleString("en-IN")}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
        { title: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" }
    ]

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto p-2">

            {/* Payment Received Toast */}
            {showToast && (
                <Toast
                    message={toastData.message}
                    type="payment"
                    amount={toastData.amount}
                    onClose={() => setShowToast(false)}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Overview of your branch performance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isConnected ? 'Live Updates On' : 'Connecting...'}
                    </div>

                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        {user?.branch} ASM
                    </span>
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        <Clock className="w-4 h-4" />
                        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Clean Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                        <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-all duration-200 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">
                                        {loading ? "..." : stat.value}
                                    </h3>
                                </div>
                                <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                                    <Icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Activity Feed */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Activity Section */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                            Recent Activity
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-500"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </h2>

                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="p-0">
                                {activitiesLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-6 h-6 border-2 border-t-transparent border-gray-300 rounded-full animate-spin"></div>
                                    </div>
                                ) : activities.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-50 flex items-center justify-center">
                                            <Clock className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-sm">No recent activity found.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {activities.map((activity, idx) => {
                                            const { icon: ActivityIcon, bgColor, iconColor } = getActivityIcon(activity.type)
                                            return (
                                                <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                                    <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${bgColor}`}>
                                                        <ActivityIcon className={`w-4 h-4 ${iconColor}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                                {activity.data.name} <span className="font-normal text-gray-500">{activity.data.action}</span>
                                                            </p>
                                                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                                {formatTimeAgo(activity.timestamp)}
                                                            </span>
                                                        </div>
                                                        {activity.type === 'order' && activity.data.product_name && (
                                                            <p className="text-xs text-gray-500 mt-0.5 truncate bg-gray-50 px-2 py-1 rounded w-fit border border-gray-100">
                                                                {activity.data.product_name} • <span className="font-medium">#{activity.data.order_id?.slice(-6)}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Referral & Actions */}
                <div className="space-y-6">

                    {/* Referral Card - Professional & Clean */}
                    {user?.refer_code && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Share2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Your Referral Code</h3>
                                        <p className="text-xs text-gray-500">Share to earn direct commissions</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-1 flex items-center gap-2 mb-4">
                                    <div className="flex-1 px-3 py-2 font-mono text-lg font-bold text-gray-800 tracking-wider text-center">
                                        {user.refer_code}
                                    </div>
                                    <button
                                        onClick={copyReferralCode}
                                        className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-all text-gray-600 hover:text-gray-900 shadow-sm"
                                        title="Copy Code"
                                    >
                                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                                        <p className="text-emerald-700 text-lg font-bold">85%</p>
                                        <p className="text-emerald-600/80 text-[10px] uppercase font-semibold tracking-wide">Direct Sales</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                                        <p className="text-blue-700 text-lg font-bold">15%</p>
                                        <p className="text-blue-600/80 text-[10px] uppercase font-semibold tracking-wide">Override</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Attributes */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Quick Attributes</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {[
                                {
                                    name: "Pending Approvals",
                                    desc: `${stats.pendingApproval} waiting`,
                                    href: "/branch/affiliate-request",
                                    icon: TrendingUp,
                                    color: "text-yellow-600",
                                    bg: "bg-yellow-50"
                                },
                                {
                                    name: "View Partners",
                                    desc: "Manage team",
                                    href: "/branch/agents",
                                    icon: Users,
                                    color: "text-orange-600",
                                    bg: "bg-orange-50"
                                },
                                {
                                    name: "Pending Payouts",
                                    desc: "Review withdrawals",
                                    href: "/branch/pending-payout",
                                    icon: CreditCard,
                                    color: "text-emerald-600",
                                    bg: "bg-emerald-50"
                                },
                                {
                                    name: "Commission Report",
                                    desc: "View earnings",
                                    href: "/branch/total-commission",
                                    icon: DollarSign,
                                    color: "text-purple-600",
                                    bg: "bg-purple-50"
                                }
                            ].map((action, i) => {
                                const Icon = action.icon
                                return (
                                    <a key={i} href={action.href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${action.bg}`}>
                                                <Icon className={`w-5 h-5 ${action.color}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{action.name}</p>
                                                <p className="text-xs text-gray-500">{action.desc}</p>
                                            </div>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
