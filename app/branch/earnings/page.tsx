"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import useSWR from 'swr'
import { DollarSign, TrendingUp, ShoppingBag, Calendar, AlertCircle, Wallet, ArrowDownCircle, ArrowUpCircle, Users, Package, Info, Wifi, WifiOff } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

type Order = {
    id: string
    order_id: string
    commission_amount: number
    created_at: string
    product_name: string
    first_name: string
    last_name: string
    refer_code: string
    type: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function EarningsPage() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)

    // Toast state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            setUser(JSON.parse(userData))
        }
    }, [])

    const { data, mutate, isLoading } = useSWR(
        user?.branch ? `/api/branch/earnings?branch=${encodeURIComponent(user.branch)}${user.id ? `&adminId=${user.id}` : ''}` : null,
        fetcher
    )

    const stats = data?.success ? data.stats : {
        totalEarnings: 0,
        overrideEarnings: 0,
        directEarnings: 0,
        totalOrders: 0,
        overrideOrders: 0,
        directOrders: 0,
        paidAmount: 0,
        currentEarnings: 0,
        commissionRate: 0
    }

    const recentOrders: Order[] = data?.success ? data.recentOrders : []
    const loading = isLoading

    // Live updates
    const handleUpdate = useCallback((data: any) => {
        if (data.type === 'stats_update' || data.type === 'payment_received') {
            setToastData({
                message: data.message || "Earnings updated!",
                amount: data.amount
            });
            setShowToast(true);
            mutate();
        }
    }, [mutate]);

    const { isConnected } = useSSE({
        affiliateCode: user?.refer_code || '',
        onMessage: handleUpdate
    });

    const formatCurrency = (amount: number) => {
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Branch Earnings</h1>
                    <p className="text-sm text-gray-500 mt-1">Detailed breakdown of your income sources</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live Updates On' : 'Connecting...'}
                </div>
            </div>

            {/* Income Breakdown Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Total Earnings Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden group transition-all hover:shadow-md">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign className="w-16 h-16 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Total Lifetime Earnings</p>
                    <h2 className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{formatCurrency(stats.totalEarnings)}</h2>

                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> From Partners</span>
                            <span className="font-medium text-gray-900">{formatCurrency(stats.overrideEarnings)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500 flex items-center gap-1"><Package className="w-3 h-3" /> From Direct Referrals</span>
                            <span className="font-medium text-gray-900">{formatCurrency(stats.directEarnings)}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Wallet/Balance Card (Dark) */}
                <div className="bg-gray-900 rounded-xl shadow-sm p-6 text-white relative overflow-hidden ring-1 ring-gray-900">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-gray-400 text-sm font-medium">Available to Withdraw</p>
                            <div className="group relative">
                                <Info className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
                                <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-3 bg-white text-gray-900 text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50 pointer-events-none text-center border border-gray-100 font-medium">
                                    This amount does not include TDS. When you get the payout, TDS (18%) will be deducted from your monthly earnings.
                                    <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white"></div>
                                </div>
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.currentEarnings)}</h3>

                        <div className="mt-4 flex items-center gap-3">
                            <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                                Ready
                            </span>
                            <span className="text-xs text-gray-400">
                                Paid Out: {formatCurrency(stats.paidAmount)}
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 p-6 opacity-10">
                        <Wallet className="w-12 h-12 text-white" />
                    </div>
                </div>

                {/* 3. Order Volume Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{stats.totalOrders}</h3>
                        </div>
                        <div className="p-2.5 rounded-lg bg-orange-50">
                            <ShoppingBag className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 flex overflow-hidden">
                            <div className="bg-blue-500 h-1.5" style={{ width: `${stats.totalOrders > 0 ? (stats.overrideOrders / stats.totalOrders) * 100 : 0}%` }}></div>
                            <div className="bg-emerald-500 h-1.5" style={{ width: `${stats.totalOrders > 0 ? (stats.directOrders / stats.totalOrders) * 100 : 0}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 pt-1">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {stats.overrideOrders} Team Orders</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {stats.directOrders} Direct Orders</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-blue-900">Earning Structure</h4>
                    <p className="text-sm text-blue-700/80 leading-relaxed">
                        You earn in two ways:
                        <span className="font-semibold"> 85% commission</span> on your direct referrals, plus
                        <span className="font-semibold"> {stats.commissionRate}% override</span> on all sales made by partners in your branch.
                    </p>
                </div>
            </div>

            {/* Recent Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Transactions</h2>
                    <div className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded border border-gray-200">
                        Last {recentOrders.length} records
                    </div>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 text-sm">
                        No earnings recorded yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer/Agent</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Your Earning</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === 'Direct Sale'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {order.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="font-medium text-gray-900">{order.product_name}</div>
                                            <div className="text-xs text-gray-500">#{order.order_id}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {order.first_name} {order.last_name}
                                            {order.refer_code && <span className="block text-xs text-gray-400">{order.refer_code}</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                            {formatCurrency(order.commission_amount)}
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
