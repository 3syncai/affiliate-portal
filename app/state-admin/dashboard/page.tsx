"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Users, DollarSign, ShoppingBag, MapPin, TrendingUp, CheckCircle, XCircle, Award } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

type Stats = {
    totalASMs: number
    totalBranches: number
    totalAgents: number
    totalCommission: number
    totalOrders: number
}

type ASM = {
    id: string
    first_name: string
    last_name: string
    city: string
    email: string
    branches: Branch[]
}

type Branch = {
    branch_name: string
    agent_count: number
    total_earnings: number
}

type Activity = {
    id: string
    type: 'approval' | 'rejection' | 'commission' | 'commission_earned' | 'payment_approved' | 'payment_rejected' | 'payment_paid' | 'withdrawal_requested' | 'affiliate_approved'
    message: string
    branch_name: string
    area?: string
    amount?: number
    created_at: string
}

export default function StateAdminDashboard() {
    const { theme } = useTheme()
    const [stats, setStats] = useState<Stats>({
        totalASMs: 0,
        totalBranches: 0,
        totalAgents: 0,
        totalCommission: 0,
        totalOrders: 0
    })
    const [asms, setASMs] = useState<ASM[]>([])
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            const parsed = JSON.parse(storedUser)
            setUserData(parsed)
            fetchDashboardData(parsed.state)
        }
    }, [])

    const fetchDashboardData = async (state: string) => {
        try {
            const [statsRes, structureRes, activitiesRes] = await Promise.all([
                axios.get(`/api/state-admin/dashboard/stats?state=${state}`),
                axios.get(`/api/state-admin/dashboard/structure?state=${state}`),
                axios.get(`/api/state-admin/dashboard/activities?state=${state}`)
            ])

            if (statsRes.data.success) {
                setStats(statsRes.data.stats)
            }
            if (structureRes.data.success) {
                setASMs(structureRes.data.asms)
            }
            if (activitiesRes.data.success) {
                setActivities(activitiesRes.data.activities)
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return 'just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'approval':
            case 'affiliate_approved':
            case 'payment_approved':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'rejection':
            case 'payment_rejected':
                return <XCircle className="w-5 h-5 text-red-600" />
            case 'commission':
            case 'commission_earned':
                return <Award className="w-5 h-5 text-blue-600" />
            case 'withdrawal_requested':
                return <DollarSign className="w-5 h-5 text-purple-600" />
            case 'payment_paid':
                return <CheckCircle className="w-5 h-5 text-emerald-600" />
            default:
                return <Users className="w-5 h-5 text-gray-600" />
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading dashboard...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">
                    Welcome back, {userData?.first_name}! Managing agents in <strong>{userData?.state}</strong>
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total Areas (ASMs) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Areas</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalASMs}</h3>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                            <MapPin className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">Total ASM coverage</p>
                </div>

                {/* Total Branches */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Branches</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalBranches}</h3>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">Across all areas</p>
                </div>

                {/* Total Commission */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Commission</p>
                            <h3 className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalCommission)}</h3>
                        </div>
                        <div className="bg-green-100 p-3 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                {/* Total Orders */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalOrders}</h3>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ASM & Branches Structure - 2/3 width */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Areas & Branches Structure</h2>
                            <p className="text-sm text-gray-500">ASMs with their branches and agents</p>
                        </div>
                    </div>

                    {asms.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No ASMs found in your state</p>
                    ) : (
                        <div className="space-y-4">
                            {asms.map((asm) => (
                                <div key={asm.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <MapPin className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{asm.first_name} {asm.last_name}</h3>
                                                <p className="text-sm text-gray-500">ASM - {asm.city}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                            {asm.branches.length} Branches
                                        </span>
                                    </div>

                                    {/* Branches under this ASM */}
                                    {asm.branches.length > 0 && (
                                        <div className="ml-12 mt-3 space-y-2">
                                            {asm.branches.map((branch, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium text-gray-700">{branch.branch_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-gray-600">{branch.agent_count} agents</span>
                                                        <span className="font-semibold text-green-600">{formatCurrency(branch.total_earnings)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity - 1/3 width */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: theme.primary }}></span>
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: theme.primary }}></span>
                        </span>
                    </div>

                    {activities.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No recent activity</p>
                    ) : (
                        <div className="relative space-y-8 pl-4 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent max-h-[600px] overflow-y-auto pr-2">
                            {activities.map((activity) => (
                                <div key={activity.id} className="relative flex items-start group">
                                    <div
                                        className="absolute left-[-5px] top-1 mt-1 h-3 w-3 rounded-full border-2 border-white bg-white flex items-center justify-center z-10"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full ring-2 ring-white" style={{ backgroundColor: theme.primary }}></div>
                                    </div>
                                    <div className="ml-6 w-full pb-4 border-b border-gray-50 last:border-0 group-last:pb-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-700 font-medium">{activity.message}</p>
                                            <div className="flex flex-col gap-1 mt-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">{activity.branch_name}</span>
                                                    <span className="text-xs text-gray-400">{formatTime(activity.created_at)}</span>
                                                </div>
                                                {activity.amount && (
                                                    <span className="text-xs font-semibold text-green-600">
                                                        {formatCurrency(activity.amount)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
