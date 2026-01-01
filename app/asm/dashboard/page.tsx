"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import Link from "next/link"
import {
    Users, DollarSign, ShoppingBag, Building2,
    Wallet, ChevronRight, UserPlus, BarChart3
} from "lucide-react"

type BranchAdmin = {
    id: string
    first_name: string
    last_name: string
    branch: string
    is_active: boolean
}

export default function ASMDashboard() {
    const [user, setUser] = useState<any>(null)
    const [stats, setStats] = useState({
        totalAgents: 0,
        totalOrders: 0,
        lifetimeEarnings: 0,
        currentEarnings: 0,
        commissionRate: 0,
        branchAdmins: [] as BranchAdmin[]
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchDashboardData(parsed.city, parsed.state, parsed.id)
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

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 text-sm">
                        Managing <span className="font-medium text-blue-600">{user?.city}</span>, {user?.state}
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                        {stats.branchAdmins.length} Branches
                    </span>
                    <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                        {stats.totalAgents} Affiliates
                    </span>
                </div>
            </div>

            {/* Wallet Card */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-6 h-6 text-emerald-400" />
                        <div>
                            <p className="text-slate-400 text-sm">Available Balance</p>
                            <p className="text-2xl font-bold">{formatCurrency(stats.currentEarnings)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-sm">Lifetime</p>
                        <p className="text-lg font-semibold text-emerald-400">{formatCurrency(stats.lifetimeEarnings)}</p>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.branchAdmins.length}</p>
                            <p className="text-xs text-gray-500">Branches</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalAgents}</p>
                            <p className="text-xs text-gray-500">Affiliates</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-2 rounded-lg">
                            <ShoppingBag className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                            <p className="text-xs text-gray-500">Orders</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-50 p-2 rounded-lg">
                            <DollarSign className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.commissionRate}%</p>
                            <p className="text-xs text-gray-500">Commission</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Branch Admins */}
                <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Branch Admins</h2>
                        <Link href="/asm/branch-admins" className="text-blue-600 text-sm hover:underline">View all</Link>
                    </div>
                    {stats.branchAdmins.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            No branch admins yet
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {stats.branchAdmins.slice(0, 3).map((admin) => (
                                <div key={admin.id} className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                                            {admin.first_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{admin.first_name} {admin.last_name}</p>
                                            <p className="text-xs text-gray-500">{admin.branch}</p>
                                        </div>
                                    </div>
                                    <span className={`w-2 h-2 rounded-full ${admin.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                    <h2 className="font-semibold text-gray-900">Quick Actions</h2>

                    <Link href="/asm/create-branch" className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <UserPlus className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">Create Branch Admin</p>
                                <p className="text-xs text-gray-500">Add new branch to your area</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                    </Link>

                    <Link href="/asm/agents" className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-50 p-2 rounded-lg">
                                <Users className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">View Affiliates</p>
                                <p className="text-xs text-gray-500">Manage agents in {user?.city}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                    </Link>

                    <Link href="/asm/earnings" className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-50 p-2 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">View Earnings</p>
                                <p className="text-xs text-gray-500">Track your commissions</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}
