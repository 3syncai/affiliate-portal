"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { DollarSign, TrendingUp, ShoppingBag, Calendar, AlertCircle, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
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
}

export default function EarningsPage() {
    const { theme } = useTheme()
    const [stats, setStats] = useState({
        totalAffiliateCommissions: 0,
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

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            if (parsed.branch) {
                fetchEarnings(parsed.branch, parsed.id)
            } else {
                setError("No branch information found for this user.")
                setLoading(false)
            }
        } else {
            setLoading(false)
        }
    }, [])

    const fetchEarnings = async (branch: string, adminId?: string) => {
        try {
            const url = adminId
                ? `/api/branch/earnings?branch=${encodeURIComponent(branch)}&adminId=${adminId}`
                : `/api/branch/earnings?branch=${encodeURIComponent(branch)}`
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
        // Fix negative zero display: if amount rounds to 0, make it positive
        const rounded = Math.round(amount * 100) / 100
        const fixedAmount = rounded === 0 ? 0 : amount
        return `₹${fixedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading earnings...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error! </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Earnings</h1>
                <p className="text-sm text-gray-500 mt-1">Track your branch commissions and sales performance</p>
            </div>

            {/* Income Overview Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Earnings Card - Primary Metric */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden group hover:border-gray-300 transition-colors">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-current transition-all group-hover:w-1.5" style={{ color: theme.primary }}></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                            <h2 className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{formatCurrency(stats.totalEarnings)}</h2>
                        </div>
                        <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${theme.primary}10` }}>
                            <TrendingUp className="w-5 h-5" style={{ color: theme.primary }} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 w-fit px-2.5 py-1 rounded-md border border-gray-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-current" style={{ color: theme.primary }}></div>
                        <span>{stats.commissionRate}% Commission Rate</span>
                    </div>
                </div>

                {/* Affiliate Commissions */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Affiliate Commissions</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">{formatCurrency(stats.totalAffiliateCommissions || 0)}</h3>
                        </div>
                        <div className="p-2.5 rounded-lg bg-blue-50">
                            <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Earnings from your branch hierarchy
                    </p>
                </div>

                {/* Total Orders */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">{stats.totalOrders}</h3>
                        </div>
                        <div className="p-2.5 rounded-lg bg-orange-50">
                            <ShoppingBag className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Completed customer orders
                    </p>
                </div>
            </div>

            {/* Wallet Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded bg-gray-100">
                        <Wallet className="w-4 h-4 text-gray-600" />
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">Wallet Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Available Balance - Highlighted */}
                    <div className="bg-gray-900 rounded-xl shadow-sm p-6 text-white relative overflow-hidden ring-1 ring-gray-900">
                        <div className="relative z-10">
                            <p className="text-gray-400 text-sm font-medium mb-1">Available Balance</p>
                            <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.currentEarnings || (stats.lifetimeEarnings - stats.paidAmount) || stats.totalEarnings)}</h3>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                                    Ready to withdraw
                                </span>
                            </div>
                        </div>
                        {/* Decorative background accent */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl"></div>
                        <div className="absolute bottom-0 right-0 p-6 opacity-10">
                            <Wallet className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    {/* Lifetime Earnings */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-full bg-emerald-50">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-600">Lifetime Earnings</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 ml-1">{formatCurrency(stats.lifetimeEarnings || stats.totalEarnings)}</p>
                    </div>

                    {/* Withdrawn Amount */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-full bg-gray-100">
                                <ArrowDownCircle className="w-4 h-4 text-gray-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-600">Withdrawn Amount</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 ml-1">{formatCurrency(stats.paidAmount)}</p>
                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-900">How is this calculated?</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Your earnings are automatically calculated as <span className="font-semibold text-gray-700">{stats.commissionRate}%</span> of the total commissions earned by affiliates in your branch hierarchy.
                        This ensures you earn a passive income from all branch activity.
                    </p>
                </div>
            </div>

            {/* Recent Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Contributing Orders</h2>
                    </div>
                    <div className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded border border-gray-200">
                        Last {recentOrders.length} orders
                    </div>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <ShoppingBag className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">No orders yet</h3>
                        <p className="text-sm text-gray-500 mt-1">Orders from your branch affiliates will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affiliate</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                #{order.order_id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{order.first_name} {order.last_name}</span>
                                                <span className="text-xs text-gray-500 font-mono">{order.refer_code}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={order.product_name}>
                                            {order.product_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                            {formatCurrency(order.order_amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
