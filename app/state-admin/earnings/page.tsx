"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { DollarSign, TrendingUp, ShoppingBag, MapPin, AlertCircle, Wallet, ArrowDownCircle, ArrowUpCircle, CreditCard, Calendar } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

type Order = {
    id: string
    order_id: string
    order_amount: number
    created_at: string
    product_name: string
    first_name: string
    last_name: string
    refer_code: string
    city: string
    branch: string
}

export default function StateAdminEarningsPage() {
    const { theme } = useTheme()
    const [stats, setStats] = useState({
        totalAffiliateCommissions: 0,
        totalBranchCommissions: 0,
        totalASMCommissions: 0,
        totalOrders: 0,
        commissionRate: 0,
        totalEarnings: 0,
        lifetimeEarnings: 0,
        paidAmount: 0,
        currentEarnings: 0
    })
    const [recentOrders, setRecentOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            const parsed = JSON.parse(storedUser)
            setUserData(parsed)
            if (parsed.state) {
                fetchEarnings(parsed.state, parsed.id)
            } else {
                setError("No state information found for this user.")
                setLoading(false)
            }
        } else {
            setLoading(false)
        }
    }, [])

    const fetchEarnings = async (state: string, adminId?: string) => {
        try {
            let url = `/api/state-admin/earnings?state=${encodeURIComponent(state)}`
            if (adminId) url += `&adminId=${adminId}`
            const response = await axios.get(url)
            if (response.data.success) {
                setStats(response.data.stats)
                setRecentOrders(response.data.recentOrders)
            }
        } catch (error) {
            console.error("Failed to fetch earnings:", error)
            setError("Failed to load earnings data. Please try again later.")
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Loading earnings...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto p-2">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">State Earnings</h1>
                <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Earnings from <span className="font-medium text-gray-900">{userData?.state}</span>
                </p>
            </div>

            {/* Wallet Section - Premium Card Design */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0f172a] text-white shadow-xl">
                {/* Abstract background shapes */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[300px] h-[300px] rounded-full bg-blue-500/10 blur-3xl"></div>

                <div className="relative p-8 md:p-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div>
                            <p className="text-emerald-200/80 font-medium text-sm tracking-wide uppercase mb-1">Total Available Balance</p>
                            <h2 className="text-5xl font-bold tracking-tight text-white mb-2">{formatCurrency(stats.currentEarnings || stats.totalEarnings)}</h2>
                            <div className="flex items-center gap-3 mt-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/20">
                                    <TrendingUp className="w-3 h-3" />
                                    Active
                                </span>
                                <p className="text-slate-400 text-sm">Ready for withdrawal</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                            <div>
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    <ArrowUpCircle className="w-4 h-4" />
                                    <span className="text-sm">Lifetime Earnings</span>
                                </div>
                                <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(stats.lifetimeEarnings || stats.totalEarnings)}</p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    <ArrowDownCircle className="w-4 h-4" />
                                    <span className="text-sm">Withdrawn</span>
                                </div>
                                <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(stats.paidAmount)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total ASM Commissions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                            <DollarSign className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                            {stats.commissionRate}% Rate
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Total ASM Commissions</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalASMCommissions || 0)}</h3>
                    <div className="mt-3 text-xs text-gray-400">
                        Base volume from ASMs in state
                    </div>
                </div>

                {/* Total Orders */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                            <ShoppingBag className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Total Orders</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</h3>
                    <div className="mt-3 text-xs text-gray-400">
                        Completed orders in {userData?.state}
                    </div>
                </div>

                {/* Branch Commissions (Contextual) */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <CreditCard className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Branch Commissions</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalBranchCommissions || 0)}</h3>
                    <div className="mt-3 text-xs text-gray-400">
                        Generated by branches
                    </div>
                </div>
            </div>

            {/* Recent Orders Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Contributing Orders</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Orders generating commission in your state</p>
                    </div>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingBag className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">No orders yet</h3>
                        <p className="text-gray-500 text-sm">Orders from your state will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/30">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Affiliate</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Value</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                    <ShoppingBag className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">#{order.order_id}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                                                    {order.first_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-900 font-medium">{order.first_name} {order.last_name}</p>
                                                    <p className="text-xs text-gray-500">{order.refer_code}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {order.city}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-sm font-bold text-gray-900">{formatCurrency(order.order_amount)}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                                Completed
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <AlertCircle className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-900">
                    <p className="font-semibold mb-1">Commission Calculation</p>
                    <p className="text-gray-600">
                        Earnings are calculated as <strong>{stats.commissionRate}%</strong> of the total commissions generated by ASMs in <strong>{userData?.state}</strong>. This is a top-level cascading commission structure (Affiliate → Branch → ASM → State).
                    </p>
                </div>
            </div>
        </div>
    )
}
