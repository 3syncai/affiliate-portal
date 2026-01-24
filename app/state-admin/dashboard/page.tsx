"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import Link from "next/link"
import {
    Users, DollarSign, ShoppingBag, Building2,
    Briefcase, ChevronRight, UserPlus, BarChart3, Clock, ArrowUpRight, TrendingUp, Share2, Copy, Check, Sparkles, Wallet,
    MoreHorizontal
} from "lucide-react"

type Activity = {
    id: string
    type: string
    message: string
    branch_name: string
    amount?: number
    created_at: string
}

export default function StateAdminDashboard() {
    const [user, setUser] = useState<any>(null)
    const [stats, setStats] = useState({
        totalASMs: 0,
        totalBranches: 0,
        totalAgents: 0,
        totalOrders: 0,
        totalCommission: 0
    })
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchDashboardData(parsed.state)

            if (!parsed.refer_code) {
                refreshUserProfile()
            }
        }
    }, [])

    const refreshUserProfile = async () => {
        try {
            const token = localStorage.getItem("affiliate_token")
            if (!token) return
            const response = await axios.get("/api/state-admin/me", { headers: { Authorization: `Bearer ${token}` } })
            if (response.data.success) {
                const updatedUser = response.data.user
                setUser(updatedUser)
                localStorage.setItem("affiliate_user", JSON.stringify(updatedUser))
            }
        } catch (error) {
            console.error("Failed to refresh user profile:", error)
        }
    }

    const fetchDashboardData = async (state: string) => {
        try {
            const [statsRes, activitiesRes] = await Promise.all([
                axios.get(`/api/state-admin/dashboard/stats?state=${encodeURIComponent(state)}`),
                axios.get(`/api/state-admin/dashboard/activities?state=${encodeURIComponent(state)}`)
            ])
            if (statsRes.data.success) setStats(statsRes.data.stats)
            if (activitiesRes.data.success) setActivities(activitiesRes.data.activities)
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
        } finally {
            setLoading(false)
        }
    }

    const copyReferralCode = async () => {
        if (user?.refer_code) {
            await navigator.clipboard.writeText(user.refer_code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 bg-gray-50/50 min-h-screen p-4">

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Overview of your state performance</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100/50">
                    <span className="text-xs font-semibold text-slate-500">{user?.state} State</span>
                    <div className="h-4 w-[1px] bg-slate-200"></div>
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">
                        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    label="Active Branches"
                    value={stats.totalBranches}
                    icon={Building2}
                    color="orange"
                    sublabel="Operating"
                />
                <StatCard
                    label="Total ASMs"
                    value={stats.totalASMs}
                    icon={Briefcase}
                    color="yellow" // Custom logic matches yellow from image
                    sublabel="Managers"
                />
                <StatCard
                    label="Total Commission"
                    value={formatCurrency(stats.totalCommission)}
                    icon={DollarSign}
                    color="green"
                    isCurrency
                />
                <StatCard
                    label="Total Orders"
                    value={stats.totalOrders}
                    icon={ShoppingBag}
                    color="purple"
                    sublabel="All Time"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Recent Activity
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </h2>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {activities.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Clock className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">No recent activity</h3>
                                <p className="text-slate-500 mt-1">Activities will appear here instantly.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {activities.slice(0, 5).map((activity, i) => (
                                    <ActivityItem key={i} activity={activity} />
                                ))}
                            </div>
                        )}
                        <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
                            <button className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider">
                                View Full History
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Referral & Attributes */}
                <div className="space-y-6">
                    {/* Referral Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <Share2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Your Referral Code</h3>
                                <p className="text-xs text-slate-500">Share to earn direct commissions</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-2 mb-6 group hover:border-indigo-200 transition-colors cursor-pointer" onClick={copyReferralCode}>
                            <span className="font-mono font-bold text-slate-700 text-lg tracking-wider">
                                {user?.refer_code || 'LOADING...'}
                            </span>
                            <div className={`p-2 rounded-lg transition-all ${copied ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-white shadow-sm group-hover:text-indigo-600'}`}>
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                <div className="text-lg font-bold text-emerald-600">~100%</div>
                                <div className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider">Direct Sales</div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                                <div className="text-lg font-bold text-blue-600">5-10%</div>
                                <div className="text-[10px] font-bold text-blue-800/60 uppercase tracking-wider">Override</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Attributes */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Quick Attributes</h3>

                        <div className="space-y-4">
                            <QuickAttrItem
                                icon={Clock}
                                label="Pending Approvals"
                                value="0 waiting"
                                color="yellow"
                                href="#"
                            />
                            <QuickAttrItem
                                icon={Users}
                                label="View Agents"
                                value="Manage team"
                                color="orange"
                                href="/state-admin/agents"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, color, sublabel, isCurrency }: any) {
    const styles = {
        orange: { bg: "bg-orange-50", text: "text-orange-600", iconBg: "bg-white" },
        purple: { bg: "bg-purple-50", text: "text-purple-600", iconBg: "bg-white" },
        green: { bg: "bg-emerald-50", text: "text-emerald-600", iconBg: "bg-white" },
        yellow: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-white" },
    }

    // @ts-ignore
    const currentStyle = styles[color] || styles.orange

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                    <h3 className={`text-2xl font-bold text-slate-800 ${isCurrency ? 'tracking-tight' : ''}`}>{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${currentStyle.bg} ${currentStyle.text} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            {/* Decorative blob */}
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${currentStyle.bg} rounded-full opacity-50 blur-2xl group-hover:opacity-70 transition-opacity`}></div>
        </div>
    )
}

function ActivityItem({ activity }: { activity: Activity }) {
    const isCommission = activity.type === 'commission'
    const isApproval = activity.type === 'approval'

    return (
        <div className="p-5 flex items-start gap-4 group hover:bg-slate-50/80 transition-colors">
            <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border 
                 ${isCommission ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                    isApproval ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                {isCommission ? <DollarSign className="w-5 h-5" /> :
                    isApproval ? <Check className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate pr-2">
                        {activity.message.split(' earned')[0]} {/* Simple parse to highlight name if possible */}
                        <span className="font-normal text-slate-600">
                            {activity.message.includes('earned') ? ' earned commission' :
                                activity.message.includes('approved') ? ' was approved' : ''}
                        </span>
                    </p>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                        {new Date(activity.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                </div>
                {isCommission && (
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 mt-1">
                        <p className="text-xs text-slate-500 line-clamp-1 italic">
                            Product commission from {activity.branch_name}
                        </p>
                    </div>
                )}
                {!isCommission && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {activity.branch_name} Branch
                    </p>
                )}
            </div>
        </div>
    )
}


function QuickAttrItem({ icon: Icon, label, value, color, href }: any) {
    const styles = {
        orange: { bg: "bg-orange-50", text: "text-orange-600" },
        yellow: { bg: "bg-amber-50", text: "text-amber-600" },
    }
    // @ts-ignore
    const s = styles[color] || styles.orange

    return (
        <Link href={href} className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors -mx-2">
            <div className={`p-3 rounded-xl ${s.bg} ${s.text}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{label}</h4>
                <p className="text-xs text-slate-400">{value}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 -mr-1" />
        </Link>
    )
}
