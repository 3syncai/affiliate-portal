"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import axios from "axios"
import useSWR from "swr"
import { Users, DollarSign, ShoppingBag, TrendingUp, Package, Wifi, WifiOff, RotateCcw } from "lucide-react"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"
import { formatISTDate } from "@/lib/datetime"

type Customer = {
    customer_id: string
    customer_name: string
    customer_email: string
    joined_at: string | null
    first_order_at: string | null
    total_orders: number
    total_order_value: number
    total_commission: number
    orders: any[]
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function StateAdminMyReferralsPage() {
    const [user, setUser] = useState<any>(null)

    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            try {
                setUser(JSON.parse(userData))
            } catch (e) {
                console.error("Error parsing user data:", e)
            }
        }
    }, [])

    const { data, mutate, isLoading } = useSWR(
        user?.refer_code
            ? `/api/state-admin/my-direct-referrals?refer_code=${encodeURIComponent(user.refer_code)}`
            : null,
        fetcher,
        { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }
    )

    const { data: dashboardData } = useSWR(
        user?.state
            ? `/api/state-admin/dashboard/stats?state=${encodeURIComponent(user.state)}`
            : null,
        fetcher,
        { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }
    )

    const totalReturns = dashboardData?.success
        ? Number(dashboardData.stats?.totalReturns ?? 0)
        : 0

    const customers: Customer[] = data?.success ? data.customers || [] : []

    const stats = (data?.success && data.stats) || {
        total_customers: 0,
        total_orders: 0,
        total_sales: 0,
        total_commissions: 0,
        pending_commissions: 0,
    }

    // The state-admin endpoint reports `pending_commissions` but no
    // `credited_commissions`; derive it so the "Available Amount" card has
    // a sensible value that always matches `total - pending`.
    const creditedCommissions = Math.max(
        0,
        Number(stats.total_commissions || 0) - Number(stats.pending_commissions || 0)
    )

    const loading = isLoading

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
        <div className="space-y-4 sm:space-y-6 min-w-0">
            {showToast && (
                <Toast
                    message={toastData.message}
                    type="payment"
                    amount={toastData.amount}
                    onClose={() => setShowToast(false)}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Direct Referrals</h1>
                    <p className="text-gray-500 text-sm mt-1">Customers who registered using your referral code</p>
                </div>
                <div
                    className={`self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                >
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? "Live Updates On" : "Connecting..."}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
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
                    label="Total Returns"
                    value={String(totalReturns)}
                    valueClass="text-rose-600"
                    sublabel="Cancelled + return requests"
                    icon={<RotateCcw className="w-6 h-6 text-rose-600" />}
                    iconBg="bg-rose-50"
                    href="/state-admin/returns"
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
                    value={formatCurrency(creditedCommissions)}
                    valueClass="text-green-600"
                    sublabel="Delivered orders"
                    icon={<DollarSign className="w-6 h-6 text-green-600" />}
                    iconBg="bg-green-50"
                />
            </div>

            {/* Customers Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Referred Customers</h2>
                </div>

                {customers.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No referrals yet</p>
                        <p className="text-gray-400 text-xs mt-1">Share your referral code to start earning!</p>
                    </div>
                ) : (
                    <>
                        <div className="md:hidden divide-y divide-gray-100">
                            {customers.map((customer) => (
                                <div key={customer.customer_id} className="p-4 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{customer.customer_name}</div>
                                    <div className="text-xs text-gray-500 truncate">{customer.customer_email}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-400 font-semibold">Joined</p>
                                            <p className="text-gray-700">{formatISTDate(customer.joined_at) || "Not yet"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-400 font-semibold">First Order</p>
                                            <p className="text-gray-700">{formatISTDate(customer.first_order_at) || "Not yet"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-400 font-semibold">Orders</p>
                                            <span
                                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${customer.total_orders > 0
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {customer.total_orders} {customer.total_orders === 1 ? "order" : "orders"}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-400 font-semibold">Spent</p>
                                            <p className="font-medium text-gray-900">{formatCurrency(customer.total_order_value)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                                        <span className="text-[10px] uppercase text-gray-400 font-semibold">Your Earnings</span>
                                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(customer.total_commission)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
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
                    </>
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
    href,
}: {
    label: string
    value: string
    sublabel?: string
    icon: React.ReactNode
    iconBg: string
    valueClass?: string
    href?: string
}) {
    const card = (
        <div
            className={`bg-white rounded-xl border border-gray-200 p-3 sm:p-5 shadow-sm min-w-0 ${
                href ? "hover:border-rose-200 cursor-pointer transition-colors h-full" : ""
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{label}</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${valueClass}`}>{value}</p>
                    {sublabel && <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">{sublabel}</p>}
                </div>
                <div className={`p-2 sm:p-3 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
            </div>
        </div>
    )

    if (href) {
        return (
            <Link href={href} className="block min-w-0">
                {card}
            </Link>
        )
    }

    return card
}
