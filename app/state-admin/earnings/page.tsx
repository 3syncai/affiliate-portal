"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import useSWR from "swr"
import { DollarSign, User, Users, ShoppingBag, Info, Wallet, CheckCircle2, AlertCircle, Wifi, WifiOff, Clock } from "lucide-react"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

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
    commission_amount?: number
    type?: string // 'Direct' or 'Override'
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function StateAdminEarningsPage() {
    const [userData, setUserData] = useState<any>(null)

    // Toast state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    useEffect(() => {
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            setUserData(JSON.parse(storedUser))
        }
    }, [])

    const { data: earningsData, mutate, isLoading } = useSWR(
        userData?.state ? `/api/state-admin/earnings?state=${encodeURIComponent(userData.state)}${userData.id ? `&adminId=${userData.id}` : ''}` : null,
        fetcher
    )

    const stats = earningsData?.success ? earningsData.stats : {
        totalOrders: 0,
        commissionRate: 0,
        totalEarnings: 0,
        lifetimeEarnings: 0,
        paidAmount: 0,
        currentEarnings: 0,
        earningsFromOverrides: 0,
        earningsFromDirect: 0,
        ordersFromOverrides: 0,
        ordersFromDirect: 0
    }

    const recentOrders: Order[] = earningsData?.success ? earningsData.recentOrders : []
    const loading = isLoading

    // Live updates
    const handleUpdate = useCallback((data: any) => {
        if (data.type === 'commission_update' || data.type === 'payment_received') {
            setToastData({
                message: data.message || "New activity received!",
                amount: data.amount
            });
            setShowToast(true);
            mutate();
        }
    }, [mutate]);

    const { isConnected } = useSSE({
        affiliateCode: userData?.refer_code || '',
        onMessage: handleUpdate
    });



    const formatCurrency = (amount: number) => {
        return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div></div>

    // Calculations for progress bar
    const totalOrders = stats.totalOrders || 1
    const overridePercent = (stats.ordersFromOverrides / totalOrders) * 100
    const directPercent = 100 - overridePercent

    return (
        <div className="space-y-6 text-gray-800">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">State Earnings</h1>
                    <p className="text-gray-500 text-sm mt-1">Detailed breakdown of income sources from {userData?.state}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium self-start md:self-auto ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live Updates On' : 'Connecting...'}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Lifetime Earnings Card (White) */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Total Lifetime Earnings</p>
                            <h2 className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.lifetimeEarnings || stats.totalEarnings)}</h2>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-50">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center text-gray-500">
                                <Users className="w-4 h-4 mr-2" />
                                From ASM/Branch Overrides
                            </div>
                            <span className="font-semibold text-gray-900">{formatCurrency(stats.earningsFromOverrides)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center text-gray-500">
                                <User className="w-4 h-4 mr-2" />
                                From Direct Referrals (100%)
                            </div>
                            <span className="font-semibold text-gray-900">{formatCurrency(stats.earningsFromDirect)}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Available to Withdraw (Dark) */}
                <div className="bg-[#0f172a] rounded-xl p-6 text-white relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Wallet className="w-24 h-24" />
                    </div>

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
                        <h2 className="text-4xl font-bold text-white mt-2">{formatCurrency(stats.currentEarnings || stats.totalEarnings)}</h2>

                        <div className="flex items-center mt-8 gap-4">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold flex items-center">
                                <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                Ready
                            </span>
                            <span className="text-xs text-gray-400">
                                Paid Out: <span className="text-gray-300 ml-1">{formatCurrency(stats.paidAmount)}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Total Orders (White with Progress) */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm relative">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Total Orders</p>
                            <h2 className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</h2>
                        </div>
                        <div className="bg-purple-50 p-2 rounded-lg">
                            <ShoppingBag className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100 mb-2">
                            <div style={{ width: `${overridePercent}%` }} className="h-full bg-blue-500 rounded-full"></div>
                            <div style={{ width: `${directPercent}%` }} className="h-full bg-emerald-400 rounded-full ml-1"></div>
                        </div>
                        <div className="flex justify-between text-xs mt-3">
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                <span className="text-gray-600">{stats.ordersFromOverrides} Hierarchy</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></div>
                                <span className="text-gray-600">{stats.ordersFromDirect} Direct</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-semibold text-blue-900">Earning Structure</h4>
                    <p className="text-sm text-blue-700 mt-0.5">
                        You earn in two ways: <span className="font-semibold">~100% commission</span> on your direct referrals, plus <span className="font-semibold"> {stats.commissionRate}% override</span> on total sales volume from ASMs and Branches in your state {userData?.state ? `(${userData.state})` : ''}.
                    </p>
                </div>
            </div>

            {/* Transaction Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Recent Transactions</h2>
                    <span className="text-xs font-medium text-gray-500 border border-gray-200 px-2 py-1 rounded">Last 10 records</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer/Branch</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Earning</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                recentOrders.map((order) => {
                                    const isDirect = order.type === 'Direct'
                                    const typeLabel = order.type || (isDirect ? 'Direct Sale' : 'Override')
                                    const typeColor = isDirect
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-blue-50 text-blue-700'

                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[11px] uppercase font-bold px-2.5 py-1 rounded-md ${typeColor}`}>
                                                    {typeLabel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 line-clamp-1">{order.product_name}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">#{order.order_id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{order.first_name} {order.last_name || ''}</div>
                                                <div className="text-xs text-gray-400 mt-0.5 uppercase">{isDirect ? order.refer_code : order.branch || order.city}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-bold ${isDirect ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {formatCurrency(Number(order.commission_amount))}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
