"use client"

import { useEffect, useState } from "react"
import {
    Users, TrendingUp, DollarSign, ShoppingBag, CheckCircle,
    UserPlus, CreditCard, Clock, ArrowUpRight, MapPin,
    Building2, BarChart3, Wallet, ChevronRight
} from "lucide-react"
import axios from "axios"
import Link from "next/link"
import { useTheme } from "@/contexts/ThemeContext"

type BranchAdmin = {
    id: string
    first_name: string
    last_name: string
    branch: string
    is_active: boolean
}

type Activity = {
    id: string
    type: string
    timestamp: string
    data: {
        message?: string
        name?: string
        branch_name?: string
        amount?: number
        product_name?: string
        order_id?: string
        action?: string
        status?: string
    }
}

export default function ASMDashboard() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [stats, setStats] = useState({
        totalAgents: 0,
        totalOrders: 0,
        lifetimeEarnings: 0,
        currentEarnings: 0,
        commissionRate: 0,
        branchAdmins: [] as BranchAdmin[]
    })
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [activitiesLoading, setActivitiesLoading] = useState(true)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchDashboardData(parsed.city, parsed.state, parsed.id)
            fetchActivities(parsed.city)
        } else {
            setLoading(false)
            setActivitiesLoading(false)
        }
    }, [])

    const fetchDashboardData = async (city: string, state: string, adminId: string) => {
        try {
            const [earningsRes, branchRes, agentsRes] = await Promise.all([
                axios.get(`/api/asm/earnings?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&adminId=${adminId}`),
                axios.get(`/api/asm/branch-admins?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`),
                axios.get(`/api/asm/agents?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`)
            ])

            setStats({
                totalAgents: agentsRes.data.success ? agentsRes.data.agents?.length || 0 : 0,
                totalOrders: earningsRes.data.success ? earningsRes.data.stats?.totalOrders || 0 : 0,
                lifetimeEarnings: earningsRes.data.success ? earningsRes.data.stats?.lifetimeEarnings || 0 : 0,
                currentEarnings: earningsRes.data.success ? earningsRes.data.stats?.currentEarnings || 0 : 0,
                commissionRate: earningsRes.data.success ? earningsRes.data.stats?.commissionRate || 0 : 0,
                branchAdmins: branchRes.data.success ? branchRes.data.branchAdmins || [] : []
            })
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchActivities = async (area: string) => {
        try {
            const response = await axios.get(`/api/asm/activity?area=${encodeURIComponent(area)}`)
            if (response.data.success) {
                setActivities(response.data.activities || [])
            }
        } catch (error) {
            console.error("Failed to fetch activities:", error)
        } finally {
            setActivitiesLoading(false)
        }
    }

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

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'commission_earned':
                return { icon: DollarSign, bgColor: "bg-blue-100", iconColor: "text-blue-600" }
            case 'affiliate_approved':
            case 'approval':
                return { icon: CheckCircle, bgColor: "bg-green-100", iconColor: "text-green-600" }
            case 'withdrawal_requested':
                return { icon: CreditCard, bgColor: "bg-purple-100", iconColor: "text-purple-600" }
            case 'payment_approved':
            case 'payment_paid':
                return { icon: CheckCircle, bgColor: "bg-emerald-100", iconColor: "text-emerald-600" }
            case 'order':
                return { icon: ShoppingBag, bgColor: "bg-indigo-100", iconColor: "text-indigo-600" }
            default:
                return { icon: Clock, bgColor: "bg-gray-100", iconColor: "text-gray-600" }
        }
    }

    const statCards = [
        { title: "Total Earnings", value: formatCurrency(stats.lifetimeEarnings), icon: Wallet, gradient: "from-emerald-500 to-emerald-600" },
        { title: "Total Agents", value: stats.totalAgents, icon: Users, gradient: "from-blue-500 to-blue-600" },
        { title: "Total Branches", value: stats.branchAdmins.length, icon: Building2, gradient: "from-violet-500 to-violet-600" },
        { title: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, gradient: "from-orange-500 to-orange-600" }
    ]

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto p-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Welcome back, {user?.first_name} • <span className="font-medium" style={{ color: theme.primary }}>Managing {user?.city}, {user?.state}</span>
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
                                    <p className="text-gray-500 text-sm">Activities from your area will appear here.</p>
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
                                                            {activity.data.branch_name && (
                                                                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-md w-fit">
                                                                    <Building2 className="w-3 h-3" />
                                                                    <span>{activity.data.branch_name}</span>
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
                    {/* ASM Overview Card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 p-4 opacity-10"
                            style={{ color: theme.primary }}
                        >
                            <MapPin className="w-24 h-24 -mr-8 -mt-8" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-bold text-gray-900 mb-1">ASM Overview</h3>
                            <p className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                {user?.city || 'Location'}, {user?.state}
                            </p>

                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Active Branches</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Live</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-gray-900">{stats.branchAdmins.filter(b => b.is_active).length}</span>
                                        <span className="text-xs text-gray-500">/ {stats.branchAdmins.length} total</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                                        <div
                                            className="h-1.5 rounded-full"
                                            style={{
                                                width: `${stats.branchAdmins.length ? (stats.branchAdmins.filter(b => b.is_active).length / stats.branchAdmins.length) * 100 : 0}%`,
                                                backgroundColor: theme.primary
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Quick Actions</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {[
                                {
                                    name: "Create Branch",
                                    desc: "Add new branch",
                                    href: "/asm/create-branch",
                                    icon: UserPlus,
                                    color: "#eab308" // yellow-500
                                },
                                {
                                    name: "View Affiliates",
                                    desc: "Manage all agents",
                                    href: "/asm/agents",
                                    icon: Users,
                                    color: "#f97316" // orange-500
                                },
                                {
                                    name: "View Earnings",
                                    desc: "Track commissions",
                                    href: "/asm/earnings",
                                    icon: BarChart3,
                                    color: "#a855f7" // purple-500
                                }
                            ].map((action, i) => {
                                const Icon = action.icon
                                return (
                                    <Link key={i} href={action.href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
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
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* Top Branches (Mini List) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Recent Branches</h3>
                            <Link href="/asm/branch-admins" className="text-xs text-blue-600 hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {stats.branchAdmins.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-xs">No branches found</div>
                            ) : (
                                stats.branchAdmins.slice(0, 3).map((admin) => (
                                    <div key={admin.id} className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                {admin.first_name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{admin.branch}</p>
                                                <p className="text-xs text-gray-500">{admin.first_name} {admin.last_name}</p>
                                            </div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${admin.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
