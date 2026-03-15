"use client"

import { useEffect, useState, useCallback } from "react"
import { Users, TrendingUp, DollarSign, ShoppingBag, Search, ArrowRight, Package, Calendar, Wifi, WifiOff } from "lucide-react"
import axios from "axios"
import useSWR from 'swr'
import { useTheme } from "@/contexts/ThemeContext"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

interface Customer {
    customer_id: string
    customer_name: string
    customer_email: string
    total_orders: number
    total_order_value: number
    total_commission: number
    first_order_at: string
    orders: Order[]
}

interface Order {
    id: string
    order_id: string
    product_name: string
    order_amount: number
    commission_earned: number
    status: string
    created_at: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function MyDirectReferralsPage() {
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

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
        fetcher
    )

    const stats = data?.success ? data.stats : {
        total_customers: 0,
        total_orders: 0,
        total_sales: 0,
        total_commissions: 0
    }

    const customers: Customer[] = data?.success ? data.customers : []
    const loading = isLoading

    // Live updates
    const handleUpdate = useCallback((data: any) => {
        if (data.type === 'stats_update' || data.type === 'payment_received') {
            setToastData({
                message: "New referral activity!",
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

    const filteredCustomers = customers.filter((customer) =>
        customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric"
        })
    }

    return (
        <div className="space-y-6">
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
                    <h1 className="text-3xl font-bold text-gray-900">My Direct Referrals</h1>
                    <p className="text-gray-600 mt-1">
                        Customers you referred directly • Earning 85% commission rate
                    </p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live Updates On' : 'Connecting...'}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Customers</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? "..." : stats.total_customers}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${theme.primary}15` }}>
                            <Users className="w-6 h-6" style={{ color: theme.primary }} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? "..." : stats.total_orders}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50">
                            <ShoppingBag className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Sales</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? "..." : `₹${stats.total_sales.toLocaleString("en-IN")}`}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-50">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Commissions</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">
                                {loading ? "..." : `₹${stats.total_commissions.toLocaleString("en-IN")}`}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-50">
                            <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search customers by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Customers List */}
            <div className="bg-white rounded-lg border border-gray-200">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-gray-500">Loading direct referrals...</div>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-16">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-gray-900 font-medium mb-1">
                            {searchTerm ? "No customers found" : "No direct referrals yet"}
                        </h3>
                        <p className="text-gray-500 text-sm">
                            {searchTerm
                                ? "Try adjusting your search"
                                : "Start sharing your referral code to earn 85% commission"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Customer
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        First Order
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Orders
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sales Value
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Commission Earned
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.customer_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {customer.customer_name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {customer.customer_email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {customer.first_order_at ? formatDate(customer.first_order_at) : "N/A"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {customer.total_orders} orders
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            ₹{customer.total_order_value.toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                            ₹{customer.total_commission.toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => setSelectedCustomer(customer)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium flex items-center gap-1"
                                            >
                                                View Orders
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Customer Orders Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {selectedCustomer.customer_name}'s Orders
                                    </h3>
                                    <p className="text-sm text-gray-500">{selectedCustomer.customer_email}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-4">
                                {selectedCustomer.orders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">
                                                        {order.product_name}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Order ID: {order.order_id}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${order.status === "CREDITED"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-yellow-100 text-yellow-800"
                                                    }`}
                                            >
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500">Order Amount</p>
                                                <p className="font-semibold text-gray-900">
                                                    ₹{order.order_amount.toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Commission (85%)</p>
                                                <p className="font-semibold text-green-600">
                                                    ₹{order.commission_earned.toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Order Date</p>
                                                <p className="font-semibold text-gray-900">
                                                    {formatDate(order.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
