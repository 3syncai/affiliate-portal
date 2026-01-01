"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { DollarSign, TrendingUp, ShoppingBag, MapPin, AlertCircle, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

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
    const { colors, theme } = useTheme()
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">State Earnings</h1>
                <p className="text-gray-600 mt-1">
                    Track your earnings from {userData?.state}
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Earnings Card */}
                {/* Total Earnings Card */}
                <div className={`bg-gradient-to-br ${colors.gradientFrom} ${colors.gradientTo} rounded-xl shadow-lg p-6 text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
                    <div className="relative">
                        <p className={`${colors.lightText} font-medium mb-1`}>Total Earnings</p>
                        <h2 className="text-4xl font-bold">{formatCurrency(stats.totalEarnings)}</h2>
                        <div className={`mt-4 flex items-center text-sm ${colors.lightText} bg-white/20 w-fit px-3 py-1 rounded-full`}>
                            <TrendingUp className="w-4 h-4 mr-1.5" />
                            <span>Calculated at {stats.commissionRate}% Commission</span>
                        </div>
                    </div>
                </div>

                {/* Total ASM Commissions Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total ASM Commissions</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalASMCommissions || 0)}</h3>
                        </div>
                        <div className="bg-green-100 p-3 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                        Total ASM commissions in your state
                    </p>
                </div>

                {/* Total Orders Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</h3>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                        Number of completed orders in state
                    </p>
                </div>
            </div>

            {/* Wallet Balance Section */}
            <div className={`bg-gradient-to-r ${colors.gradientFrom} ${colors.gradientTo} rounded-xl shadow-lg p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <Wallet className="w-8 h-8 mr-3" />
                        <h2 className="text-xl font-bold">My Wallet</h2>
                    </div>
                    <span className="text-sm bg-white/20 px-3 py-1 rounded-full">Current Balance</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Lifetime Earnings */}
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className={`flex items-center ${colors.lightText} mb-2`}>
                            <ArrowUpCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm font-medium">Lifetime Earnings</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.lifetimeEarnings || stats.totalEarnings)}</p>
                        <p className={`text-xs ${colors.lightText} mt-1`}>Total earned ever</p>
                    </div>

                    {/* Paid Amount */}
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className={`flex items-center ${colors.lightText} mb-2`}>
                            <ArrowDownCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm font-medium">Withdrawn Amount</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.paidAmount)}</p>
                        <p className={`text-xs ${colors.lightText} mt-1`}>Amount already paid</p>
                    </div>

                    {/* Current Balance */}
                    <div className="bg-white/20 rounded-lg p-4 border-2 border-white/30">
                        <div className="flex items-center text-white mb-2">
                            <Wallet className="w-5 h-5 mr-2" />
                            <span className="text-sm font-bold">Available Balance</span>
                        </div>
                        <p className="text-3xl font-bold">{formatCurrency(stats.currentEarnings || stats.totalEarnings)}</p>
                        <p className={`text-xs ${colors.lightText} mt-1`}>Available for withdrawal</p>
                    </div>
                </div>
            </div>

            {/* info alert */}
            <div className={`${colors.lightBg} border border-${theme}-200 rounded-lg p-4 flex items-start`}>
                <AlertCircle className={`w-5 h-5 ${colors.text} mt-0.5 mr-3 flex-shrink-0`} />
                <div>
                    <h4 className={`text-sm font-semibold ${colors.secondaryText}`}>Calculation Method</h4>
                    <p className={`text-sm ${colors.secondaryText} mt-1`}>
                        Your earnings are calculated as <strong>{stats.commissionRate}%</strong> of the total ASM commissions in <strong>{userData?.state}</strong> (cascading: Affiliate → Branch → ASM → State).
                    </p>
                </div>
            </div>

            {/* Contributing Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Contributing Orders</h2>
                    <p className="text-sm text-gray-500">Recent orders from your state</p>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No orders recorded in this state yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affiliate</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Order Amount</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            #{order.order_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{order.first_name} {order.last_name}</div>
                                            <div className="text-xs text-gray-500">{order.refer_code}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {order.city}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
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
