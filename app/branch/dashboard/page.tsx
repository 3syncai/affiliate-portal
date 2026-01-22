"use client"

import { useEffect, useState } from "react"
import { Users, TrendingUp, DollarSign, ShoppingBag, CheckCircle, UserPlus, CreditCard, Clock, ArrowUpRight, MapPin, Copy } from "lucide-react"
import axios from "axios"
import { useTheme } from "@/contexts/ThemeContext"

type Activity = {
    id: string
    type: 'affiliate_request' | 'order' | 'approval' | 'withdrawal' | 'payment' | 'commission_earned' | 'withdrawal_requested' | 'payment_approved' | 'payment_rejected' | 'payment_paid' | 'affiliate_approved'
    timestamp: string
    data: {
        name?: string
        action?: string
        message?: string  // Pre-formatted hierarchical message from API
        amount?: number
        order_id?: string
        product_name?: string
        commission_amount?: number
        status?: string
        transaction_id?: string
        metadata?: any
    }
}

export default function BranchDashboard() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [referralCode, setReferralCode] = useState<string>("")
    const [copied, setCopied] = useState(false)
    const [stats, setStats] = useState({
        totalAgents: 0,
        pendingApproval: 0,
        totalCommission: 0,
        totalOrders: 0
    })
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [activitiesLoading, setActivitiesLoading] = useState(true)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            setReferralCode(parsed.refer_code || "")
            fetchStats(parsed.branch)
            fetchActivities(parsed.branch)
        } else {
            setLoading(false)
            setActivitiesLoading(false)
        }
    }, [])

    const fetchStats = async (branch: string) => {
        try {
            const response = await axios.get(`/api/branch/stats?branch=${encodeURIComponent(branch)}`)
            if (response.data.success) {
                setStats(response.data.stats)
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchActivities = async (branch: string) => {
        try {
            const response = await axios.get(`/api/branch/activity?branch=${encodeURIComponent(branch)}`)
            if (response.data.success) {
                setActivities(response.data.activities || [])
            }
        } catch (error) {
            console.error("Failed to fetch activities:", error)
        } finally {
            setActivitiesLoading(false)
        }
    }

    const copyReferralCode = () => {
        if (referralCode) {
            navigator.clipboard.writeText(referralCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const formatTimeAgo = (timestamp: string) => {
        const now = new Date()
        const date = new Date(timestamp)
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

        // Show relative time only for recent activities
        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`

        // For anything older than 24h, show actual date
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
            case 'affiliate_approved':
                return { icon: CheckCircle, bgColor: "bg-green-100", iconColor: "text-green-600" }
            case 'affiliate_request':
                return { icon: UserPlus, bgColor: "bg-orange-100", iconColor: "text-orange-600" }
            case 'order':
            case 'commission_earned':
                return { icon: DollarSign, bgColor: "bg-blue-100", iconColor: "text-blue-600" }
            case 'withdrawal':
            case 'withdrawal_requested':
                return { icon: CreditCard, bgColor: "bg-purple-100", iconColor: "text-purple-600" }
            case 'payment':
            case 'payment_approved':
                return { icon: CheckCircle, bgColor: "bg-green-100", iconColor: "text-green-600" }
            case 'payment_rejected':
                return { icon: CreditCard, bgColor: "bg-red-100", iconColor: "text-red-600" }
            case 'payment_paid':
                return { icon: CreditCard, bgColor: "bg-emerald-100", iconColor: "text-emerald-600" }
            default:
                return { icon: Clock, bgColor: "bg-gray-100", iconColor: "text-gray-600" }
        }
    }

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'approval': return "text-green-600"
            case 'affiliate_request': return "text-orange-600"
            case 'order': return "text-blue-600"
            case 'withdrawal': return "text-purple-600"
            default: return "text-gray-600"
        }
    }

    const statCards = [
        { title: "Total Agents", value: stats.totalAgents, icon: Users, gradient: "from-orange-500 to-orange-600" },
        { title: "Pending Approval", value: stats.pendingApproval, icon: TrendingUp, gradient: "from-yellow-500 to-yellow-600" },
        { title: "Total Commission", value: `₹${stats.totalCommission.toLocaleString("en-IN")}`, icon: DollarSign, gradient: "from-green-500 to-green-600" },
        { title: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, gradient: "from-purple-500 to-purple-600" }
    ]

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto p-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Welcome back, {user?.first_name} • <span className="font-medium" style={{ color: theme.primary }}>{user?.branch} Branch</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                    <Clock className="w-4 h-4" />
                    <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                        <div key={index} className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-all duration-200 hover:shadow-md relative overflow-hidden">
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{stat.title}</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">
                                        {loading ? "..." : stat.value}
                                    </h3>
                                </div>
                                <div
                                    className="p-3 rounded-lg transition-colors"
                                    style={{
                                        backgroundColor: `${theme.primary}10`,
                                        color: theme.primary
                                    }}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>
                            {/* Decorational background circle */}
                            <div
                                className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"
                                style={{ backgroundColor: theme.primary }}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity - Takes 2 columns */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            Recent Activity
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: theme.primary }}></span>
                                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: theme.primary }}></span>
                            </span>
                        </h2>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-6">
                            {activitiesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex items-center gap-3 text-gray-500">
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.primary }}></div>
                                        <span className="text-sm font-medium">Loading activity feed...</span>
                                    </div>
                                </div>
                            ) : activities.length === 0 ? (
                                <div className="text-center py-16">
                                    <div
                                        className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: `${theme.primary}10` }}
                                    >
                                        <Clock className="w-8 h-8" style={{ color: theme.primary }} />
                                    </div>
                                    <h3 className="text-gray-900 font-medium mb-1">No recent activity</h3>
                                    <p className="text-gray-500 text-sm">Activities from your branch will appear here.</p>
                                </div>
                            ) : (
                                <div className="relative space-y-8 pl-4 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                                    {activities.map((activity, idx) => {
                                        const { icon: ActivityIcon, bgColor, iconColor } = getActivityIcon(activity.type)
                                        return (
                                            <div key={activity.id} className="relative flex items-start group">
                                                <div
                                                    className="absolute left-[-5px] top-1 mt-1 h-3 w-3 rounded-full border-2 border-white bg-white flex items-center justify-center z-10"
                                                >
                                                    <div className="h-1.5 w-1.5 rounded-full ring-2 ring-white" style={{ backgroundColor: theme.primary }}></div>
                                                </div>
                                                <div className="ml-6 w-full">
                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                                                                {activity.data.message || `${activity.data.name} ${activity.data.action}`}
                                                            </p>
                                                            {(activity.type === 'order' || activity.type === 'commission_earned') && activity.data.product_name && (
                                                                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-md w-fit">
                                                                    <ShoppingBag className="w-3 h-3" />
                                                                    <span className="truncate max-w-[200px]">{activity.data.product_name}</span>
                                                                    {activity.data.order_id && (
                                                                        <span className="border-l border-gray-300 pl-2 ml-1">#{activity.data.order_id?.slice(-8)}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {activity.data.amount && activity.data.amount > 0 && (
                                                                <div className="mt-1 text-xs font-medium text-green-600">
                                                                    ₹{activity.data.amount.toFixed(2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-400 whitespace-nowrap pt-0.5">
                                                            {formatTimeAgo(activity.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Referral Code Card */}
                    {referralCode && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
                            <div
                                className="absolute top-0 right-0 p-4 opacity-5"
                                style={{ backgroundColor: theme.primary }}
                            >
                                <div className="w-24 h-24 -mr-8 -mt-8 rounded-full" />
                            </div>

                            <div className="relative z-10">
                                <h3 className="font-bold text-gray-900 mb-1">Your Referral Code</h3>
                                <p className="text-xs text-gray-500 mb-4">Share this code with new affiliates</p>

                                <div className="space-y-3">
                                    <div
                                        className="p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md"
                                        style={{
                                            backgroundColor: `${theme.primary}08`,
                                            borderColor: `${theme.primary}30`
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 mb-1">Referral Code</p>
                                                <p
                                                    className="text-2xl font-bold tracking-wider font-mono"
                                                    style={{ color: theme.primary }}
                                                >
                                                    {referralCode}
                                                </p>
                                            </div>
                                            <button
                                                onClick={copyReferralCode}
                                                className="p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                                style={{
                                                    backgroundColor: copied ? '#10b981' : theme.primary,
                                                    color: 'white'
                                                }}
                                                title="Copy referral code"
                                            >
                                                {copied ? (
                                                    <CheckCircle className="w-5 h-5" />
                                                ) : (
                                                    <Copy className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {copied && (
                                        <p className="text-xs font-medium text-green-600 text-center animate-pulse">
                                            ✓ Copied to clipboard!
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Branch Status Card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 p-4 opacity-10"
                            style={{ color: theme.primary }}
                        >
                            <UserPlus className="w-24 h-24 -mr-8 -mt-8" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-bold text-gray-900 mb-1">Branch Overview</h3>
                            <p className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                {user?.city || 'Location'}, India
                            </p>

                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Active Agents</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Live</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-gray-900">{stats.totalAgents}</span>
                                        <span className="text-xs text-gray-500">total agents</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                                        <div
                                            className="h-1.5 rounded-full"
                                            style={{ width: '70%', backgroundColor: theme.primary }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
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
                                    color: "#eab308" // yellow-500
                                },
                                {
                                    name: "View Agents",
                                    desc: "Manage team",
                                    href: "/branch/agents",
                                    icon: Users,
                                    color: "#f97316" // orange-500
                                },
                                {
                                    name: "Pending Payouts",
                                    desc: "Review withdrawals",
                                    href: "/branch/pending-payout",
                                    icon: CreditCard,
                                    color: "#10b981" // green-500
                                },
                                {
                                    name: "Commission Report",
                                    desc: "View earnings",
                                    href: "/branch/total-commission",
                                    icon: DollarSign,
                                    color: "#a855f7" // purple-500
                                }
                            ].map((action, i) => {
                                const Icon = action.icon
                                return (
                                    <a key={i} href={action.href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: `${action.color}15` }}
                                            >
                                                <Icon className="w-5 h-5" style={{ color: action.color }} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{action.name}</p>
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
