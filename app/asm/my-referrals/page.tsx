"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Users, DollarSign, ShoppingBag, TrendingUp, Package } from "lucide-react"

type Customer = {
    customer_id: string
    customer_name: string
    customer_email: string
    joined_at: string
    first_order_at: string | null
    total_orders: number
    total_order_value: number
    total_commission: number
    orders: any[]
}

export default function ASMMyReferralsPage() {
    const [loading, setLoading] = useState(true)
    const [customers, setCustomers] = useState<Customer[]>([])
    const [stats, setStats] = useState({
        total_customers: 0,
        total_orders: 0,
        total_sales: 0,
        total_commissions: 0,
        pending_commissions: 0,
        credited_commissions: 0
    })

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            if (parsed.id) {
                fetchReferrals(parsed.id)
            }
        } else {
            setLoading(false)
        }
    }, [])

    const fetchReferrals = async (adminId: string) => {
        try {
            const response = await axios.get(`/api/asm/my-referrals?adminId=${adminId}`)
            if (response.data.success) {
                setCustomers(response.data.customers || [])
                setStats(response.data.stats || {
                    total_customers: 0,
                    total_orders: 0,
                    total_sales: 0,
                    total_commissions: 0,
                    pending_commissions: 0,
                    credited_commissions: 0
                })
            }
        } catch (error) {
            console.error("Failed to fetch referrals:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not yet'
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Direct Referrals</h1>
                <p className="text-gray-500 text-sm mt-1">Customers who registered using your referral code</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Customers</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_customers}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_orders}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Sales</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.total_sales)}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Your Earnings</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.total_commissions)}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Pending Amount</p>
                            <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(stats.pending_commissions)}</p>
                            <p className="text-xs text-gray-400 mt-1">Awaiting delivery</p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg">
                            <Package className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Available Amount</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.credited_commissions)}</p>
                            <p className="text-xs text-gray-400 mt-1">Delivered orders</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Referred Customers</h2>
                </div>

                {customers.length === 0 ? (
                    <div className="p-12 text-center">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No referrals yet</p>
                        <p className="text-gray-400 text-xs mt-1">Share your referral code to start earning!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Earnings</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map((customer) => (
                                    <tr key={customer.customer_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{customer.customer_name}</div>
                                            <div className="text-xs text-gray-500">{customer.customer_email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(customer.joined_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(customer.first_order_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${customer.total_orders > 0
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {customer.total_orders} {customer.total_orders === 1 ? 'order' : 'orders'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatCurrency(customer.total_order_value)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                                            {formatCurrency(customer.total_commission)}
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
