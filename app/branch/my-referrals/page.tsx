"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import useSWR from "swr"
import { Users, DollarSign, ShoppingBag, TrendingUp, Package, Wifi, WifiOff } from "lucide-react"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"
import { formatISTDate } from "@/lib/datetime"
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge"

type CustomerOrder = {
    id: string
    order_id: string
    product_name: string
    order_amount: number
    commission_earned: number
    status: string
    unlock_at: string | null
    credited_at: string | null
    has_return: boolean
    created_at: string
}

type Customer = {
    customer_id: string
    customer_name: string
    customer_email: string
    joined_at: string | null
    first_order_at: string | null
    total_orders: number
    total_order_value: number
    total_commission: number
    orders: CustomerOrder[]
}

type RecentOrder = {
    order_id: string
    product_name: string
    order_amount: number
    commission_earned: number
    customer_name: string | null
    status: string
    unlock_at: string | null
    credited_at: string | null
    has_return: boolean
    created_at: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function BranchMyReferralsPage() {
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
        user?.refer_code ? `/api/branch/my-direct-referrals?refer_code=${user.refer_code}` : null,
        fetcher,
        { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }
    )

    const customers: Customer[] = data?.success ? data.customers || [] : []
    const recentOrders: RecentOrder[] = data?.success ? data.recentOrders || [] : []

    const stats = (data?.success && data.stats) || {
        total_customers: 0,
        total_orders: 0,
        total_sales: 0,
        total_commissions: 0,
        pending_commissions: 0,
        credited_commissions: 0,
    }

    const loading = isLoading

    // Live updates via SSE
    const handleUpdate = useCallback(
        (incoming: any) => {
            if (incoming.type === "stats_update" || incoming.type === "payment_received") {
                setToastData({
                    message: "New referral activity!",
                    amount: incoming.amount,
                })
                setShowToast(true)
                mutate()
            }
        },
        [mutate]
    )

    const { isConnected } = useSSE({
        affiliateCode: user?.refer_code || "",
        onMessage: handleUpdate,
    })

    const formatCurrency = (amount: number) =>
        `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Toast */}
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
                    <h1 className="text-2xl font-bold text-gray-900">My Direct Referrals</h1>
                    <p className="text-gray-500 text-sm mt-1">Customers who registered using your referral code</p>
                </div>
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                >
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? "Live Updates On" : "Connecting..."}
                </div>
            </div>

            {/* Stats Cards (6) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                    label="Total Customers"
                    value={String(stats.total_customers)}
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    iconBg="bg-blue-50"
                />
                <StatCard
                    label="Total Orders"
                    value={String(stats.total_orders)}
                    icon={<ShoppingBag className="w-6 h-6 text-purple-600" />}
                    iconBg="bg-purple-50"
                />
                <StatCard
                    label="Total Sales"
                    value={formatCurrency(stats.total_sales)}
                    icon={<DollarSign className="w-6 h-6 text-green-600" />}
                    iconBg="bg-green-50"
                />
                <StatCard
                    label="Your Earnings"
                    value={formatCurrency(stats.total_commissions)}
                    icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                />
                <StatCard
                    label="Pending Amount"
                    value={formatCurrency(stats.pending_commissions)}
                    valueClass="text-yellow-600"
                    sublabel="Awaiting delivery"
                    icon={<Package className="w-6 h-6 text-yellow-600" />}
                    iconBg="bg-yellow-50"
                />
                <StatCard
                    label="Available Amount"
                    value={formatCurrency(stats.credited_commissions)}
                    valueClass="text-green-600"
                    sublabel="Delivered orders"
                    icon={<DollarSign className="w-6 h-6 text-green-600" />}
                    iconBg="bg-green-50"
                />
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
                                            {formatISTDate(customer.joined_at) || "Not yet"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatISTDate(customer.first_order_at) || "Not yet"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded-full ${customer.total_orders > 0
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {customer.total_orders} {customer.total_orders === 1 ? "order" : "orders"}
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

            {/* Recent Commissions — shows the live 5-min unlock timer per order */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Commissions</h2>
                    <span className="text-xs text-gray-500">Live updates every 5s</span>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-12 text-center">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No commissions yet</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {recentOrders.map((order) => {
                            const cancelledOrReturned =
                                order.has_return || order.status === "CANCELLED"
                            return (
                                <li
                                    key={order.order_id + order.created_at}
                                    className="px-6 py-4 flex items-center justify-between gap-4"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {order.product_name || "Order"}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {order.customer_name || "Customer"} · {formatISTDate(order.created_at)}
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">
                                            {order.order_id}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div
                                            className={`text-sm font-bold ${cancelledOrReturned
                                                ? "text-gray-400 line-through"
                                                : "text-emerald-600"
                                                }`}
                                        >
                                            +{formatCurrency(order.commission_earned)}
                                        </div>
                                        <div className="mt-1">
                                            <CommissionStatusBadge
                                                status={order.status}
                                                unlockAt={order.unlock_at}
                                                hasReturn={order.has_return}
                                            />
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}

function StatCard({
    label,
    value,
    sublabel,
    icon,
    iconBg,
    valueClass = "text-gray-900",
}: {
    label: string
    value: string
    sublabel?: string
    icon: React.ReactNode
    iconBg: string
    valueClass?: string
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 font-medium">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
                    {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
                </div>
                <div className={`p-3 rounded-lg ${iconBg}`}>{icon}</div>
            </div>
        </div>
    )
}
