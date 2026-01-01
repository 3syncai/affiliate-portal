"use client"

import { useEffect, useState } from "react"
import { Users, TrendingUp, DollarSign, ShoppingBag, CheckCircle, UserPlus, CreditCard, Clock, ArrowUpRight } from "lucide-react"
import axios from "axios"
import { useTheme } from "@/contexts/ThemeContext"

type Activity = {
    id: string
    type: 'affiliate_request' | 'order' | 'approval' | 'withdrawal'
    timestamp: string
    data: {
        name: string
        action: string
        amount?: number
        order_id?: string
        product_name?: string
        commission_amount?: number
        status?: string
    }
}

export default function BranchDashboard() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
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

    const formatTimeAgo = (timestamp: string) => {
        const now = new Date()
        const date = new Date(timestamp)
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">
                    Welcome back, {user?.first_name}! Managing <span className="font-semibold text-orange-600">{user?.branch}</span> branch
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">
                                        {loading ? "..." : stat.value}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl shadow-lg" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.sidebar})` }}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity - Takes 2 columns */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                            <p className="text-sm text-gray-500">Latest updates from your branch</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: theme.primary }}>
                            <Clock className="w-4 h-4" />
                            Live
                        </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {activitiesLoading ? (
                            <div className="p-8 flex items-center justify-center">
                                <div className="flex items-center gap-3 text-gray-500">
                                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Loading activities...</span>
                                </div>
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.primaryLight }}>
                                    <Clock className="w-6 h-6" style={{ color: theme.primary }} />
                                </div>
                                <p className="text-gray-500">No recent activity in your branch</p>
                            </div>
                        ) : (
                            activities.map((activity) => {
                                const { icon: ActivityIcon, bgColor, iconColor } = getActivityIcon(activity.type)
                                return (
                                    <div key={activity.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className={`${bgColor} p-2.5 rounded-full flex-shrink-0`}>
                                                <ActivityIcon className={`w-5 h-5 ${iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900">{activity.data.name}</span>
                                                    <span className={`text-sm ${getActivityColor(activity.type)}`}>
                                                        {activity.data.action}
                                                    </span>
                                                </div>
                                                {activity.type === 'order' && activity.data.product_name && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                                        Order #{activity.data.order_id?.slice(-10)} • {activity.data.product_name}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {formatTimeAgo(activity.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Quick Actions - Takes 1 column */}
                <div className="space-y-4">
                    {/* Branch Info Card */}
                    <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.sidebar})` }}>
                        <h3 className="text-lg font-bold mb-2">Branch Overview</h3>
                        <p className="text-white/80 text-sm mb-4">
                            Managing {user?.branch} branch in {user?.city}
                        </p>
                        <div className="flex items-center gap-2 text-sm bg-white/20 rounded-lg px-3 py-2">
                            <Users className="w-4 h-4" />
                            <span>{stats.totalAgents} active agents</span>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-900">Quick Actions</h3>
                        </div>
                        <div className="p-2">
                            <a href="/branch/affiliate-request" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                                <div className="bg-yellow-100 p-2 rounded-lg group-hover:bg-yellow-200 transition-colors">
                                    <TrendingUp className="w-5 h-5 text-yellow-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Pending Approvals</p>
                                    <p className="text-xs text-gray-500">{stats.pendingApproval} requests waiting</p>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                            </a>
                            <a href="/branch/agents" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                                <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors">
                                    <Users className="w-5 h-5 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">View Agents</p>
                                    <p className="text-xs text-gray-500">Manage all agents</p>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                            </a>
                            <a href="/branch/pending-payout" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                                <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                                    <CreditCard className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Pending Payouts</p>
                                    <p className="text-xs text-gray-500">Review withdrawals</p>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                            </a>
                            <a href="/branch/total-commission" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                                <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                                    <DollarSign className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Commission Report</p>
                                    <p className="text-xs text-gray-500">View earnings</p>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
