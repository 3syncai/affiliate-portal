"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { DollarSign, User, Users, ShoppingBag, Info, Wallet, CheckCircle2, AlertCircle } from "lucide-react"

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
    commission_source?: string
}

export default function ASMEarningsPage() {
    const [stats, setStats] = useState({
        totalAffiliateCommissions: 0,
        totalBranchCommissions: 0,
        totalOrders: 0,
        commissionRate: 0,
        totalEarnings: 0,
        lifetimeEarnings: 0,
        paidAmount: 0,
        currentEarnings: 0,
        // Detailed breakdown
        earningsFromBranch: 0,
        earningsFromDirect: 0,
        ordersFromBranch: 0,
        ordersFromDirect: 0
    })
    const [recentOrders, setRecentOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            const parsed = JSON.parse(storedUser)
            setUserData(parsed)
            if (parsed.city && parsed.state) {
                fetchEarnings(parsed.city, parsed.state, parsed.id)
            }
        }
    }, [])

    const fetchEarnings = async (city: string, state: string, adminId?: string) => {
        try {
            let url = `/api/asm/earnings?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
            if (adminId) url += `&adminId=${adminId}`
            const response = await axios.get(url)
            if (response.data.success) {
                setStats(response.data.stats)
                setRecentOrders(response.data.recentOrders)
            }
        } catch (error) {
            console.error("Failed to fetch earnings:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>

    // Calculations for progress bar
    const totalOrders = stats.totalOrders || 1
    const branchPercent = (stats.ordersFromBranch / totalOrders) * 100
    const directPercent = 100 - branchPercent

    return (
        <div className="space-y-6 text-gray-800">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Branch Earning</h1>
                <p className="text-gray-500 text-sm mt-1">Detailed breakdown of income sources from {userData?.city}</p>
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
                                From ASM Overrides
                            </div>
                            <span className="font-semibold text-gray-900">{formatCurrency(stats.earningsFromBranch)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center text-gray-500">
                                <User className="w-4 h-4 mr-2" />
                                From Direct Referrals
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
                        <p className="text-gray-400 text-sm font-medium">Available to Withdraw</p>
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
                        <div className="bg-orange-50 p-2 rounded-lg">
                            <ShoppingBag className="w-5 h-5 text-orange-500" />
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100 mb-2">
                            <div style={{ width: `${branchPercent}%` }} className="h-full bg-blue-500 rounded-full"></div>
                            <div style={{ width: `${directPercent}%` }} className="h-full bg-emerald-400 rounded-full ml-1"></div>
                        </div>
                        <div className="flex justify-between text-xs mt-3">
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                <span className="text-gray-600">{stats.ordersFromBranch} Area's Order</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></div>
                                <span className="text-gray-600">{stats.ordersFromDirect} Direct Orders</span>
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
                        You earn in two ways: <span className="font-semibold">95% commission</span> on your direct referrals, plus <span className="font-semibold"> {stats.commissionRate}% override</span> on total sales volume from area in your branches.
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
                                    // Determine type based on data (logic would be improved with real source field)
                                    const isDirect = !order.branch || order.branch === 'N/A'
                                    const typeLabel = isDirect ? 'Direct Sale' : 'Asm Override'
                                    const typeColor = isDirect
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-700'

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
                                                <div className="text-sm text-gray-900">{order.first_name || 'Customer'}</div>
                                                <div className="text-xs text-gray-400 mt-0.5 uppercase">{isDirect ? order.refer_code : order.branch}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {/* In real app, this should be the commission amount per order row */}
                                                    {/* Using order_amount * rate mostly, but should check if api returns commission_amount */}
                                                    {/* Assuming API helper calculates it or returns it. If not, fallback logic: */}
                                                    {formatCurrency(Number((order as any).commission_amount) || (order.order_amount * (stats.commissionRate / 100)))}
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
