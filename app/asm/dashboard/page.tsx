"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import useSWR from 'swr'
import Link from "next/link"
import {
    Users, DollarSign, ShoppingBag, Building2,
    Wallet, ChevronRight, UserPlus, BarChart3, Copy, Check, Share2, Clock, ArrowUpRight, Wifi, WifiOff
} from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

type BranchAdmin = {
    id: string
    first_name: string
    last_name: string
    branch: string
    is_active: boolean
}

type Order = {
    id: string
    product_name: string
    commission_amount: number
    created_at: string
    first_name: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function ASMDashboard() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [copied, setCopied] = useState(false)

    // Toast state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            setUser(JSON.parse(userData))
        }
    }, [])

    const { data: earningsData, mutate: mutateEarnings, isLoading: earningsLoading } = useSWR(
        user?.city && user?.state ? `/api/asm/earnings?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ''}` : null,
        fetcher
    )

    const { data: branchData, mutate: mutateBranches, isLoading: branchesLoading } = useSWR(
        user?.city && user?.state ? `/api/asm/branch-admins?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}` : null,
        fetcher
    )

    const { data: agentsData, mutate: mutateAgents, isLoading: agentsLoading } = useSWR(
        user?.city && user?.state ? `/api/asm/agents?city=${encodeURIComponent(user.city)}&state=${encodeURIComponent(user.state)}` : null,
        fetcher
    )

    const stats = {
        totalAgents: agentsData?.success ? agentsData.agents?.length || 0 : 0,
        totalOrders: earningsData?.success ? earningsData.stats?.totalOrders || 0 : 0,
        lifetimeEarnings: earningsData?.success ? earningsData.stats?.lifetimeEarnings || 0 : 0,
        currentEarnings: earningsData?.success ? earningsData.stats?.currentEarnings || 0 : 0,
        commissionRate: earningsData?.success ? earningsData.stats?.commissionRate || 0 : 0,
        branchAdmins: branchData?.success ? branchData.branchAdmins || [] : [] as BranchAdmin[],
        recentActivity: earningsData?.success ? earningsData.recentOrders || [] : [] as Order[]
    }

    const loading = earningsLoading || branchesLoading || agentsLoading

    // Live updates
    const handleUpdate = useCallback((data: any) => {
        if (data.type === 'stats_update' || data.type === 'payment_received') {
            setToastData({
                message: data.message || "New activity received!",
                amount: data.amount
            });
            setShowToast(true);
            mutateEarnings();
            mutateBranches();
            mutateAgents();
        }
    }, [mutateEarnings, mutateBranches, mutateAgents]);

    const { isConnected } = useSSE({
        affiliateCode: user?.refer_code || '',
        onMessage: handleUpdate
    });

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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">
                        Overview of your area performance in <span className="font-semibold text-gray-900">{user?.city}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isConnected ? 'Live Updates On' : 'Connecting...'}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 shadow-sm flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Branches</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.branchAdmins.length}</h3>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-xl">
                            <Building2 className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Partners</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.totalAgents}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Commission</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(stats.lifetimeEarnings)}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-xl">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.totalOrders}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl">
                            <ShoppingBag className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                        {stats.recentActivity.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No recent activity found.
                            </div>
                        ) : (
                            stats.recentActivity.slice(0, 5).map((activity: Order, i: number) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                <span className="font-bold">{activity.first_name || 'Customer'}</span> generated commission
                                            </p>
                                            <p className="text-xs text-gray-500 line-clamp-1">{activity.product_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-green-600">+{formatCurrency(activity.commission_amount || 0)}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(activity.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div className="p-3 text-center border-t border-gray-50">
                            <Link href="/asm/earnings" className="text-xs font-medium text-blue-600 hover:text-blue-700 uppercase tracking-wide">
                                View Full History
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Column: Referral Code & Quick Actions */}
                <div className="space-y-6">
                    {/* Referral Code Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Share2 className="w-4 h-4 text-blue-500" />
                                    Your Referral Code
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Share to earn direct commissions</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-center font-bold text-gray-800 tracking-wider">
                                {user?.refer_code || 'LOADING...'}
                            </div>
                            <button
                                onClick={copyReferralCode}
                                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-500" />}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center">
                                <p className="text-xl font-bold text-emerald-600">95%</p>
                                <p className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-wide">Direct Sales</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                                <p className="text-xl font-bold text-blue-600">{stats.commissionRate}%</p>
                                <p className="text-[10px] font-bold text-blue-800/60 uppercase tracking-wide">Override</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Attributes / Actions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-4">Quick Actions</h3>

                        <div className="space-y-4">
                            <Link href="/asm/create-branch" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Create Branch</p>
                                        <p className="text-xs text-gray-500">Add new branch to area</p>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                            </Link>

                            <Link href="/asm/agents" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">View Partners</p>
                                        <p className="text-xs text-gray-500">Manage team members</p>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                            </Link>

                            <Link href="/asm/earnings" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                        <DollarSign className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">My Earnings</p>
                                        <p className="text-xs text-gray-500">Track your commissions</p>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
