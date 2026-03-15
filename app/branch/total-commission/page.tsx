"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { DollarSign, TrendingUp, Wallet, ShoppingBag, Eye, Download } from "lucide-react"

type AffiliateCommission = {
    user_id: string
    first_name: string
    last_name: string
    email: string
    referral_code: string
    phone?: string | null
    branch?: string
    wallet_amount: number
    total_commission: number
    pending_amount: number
    total_orders: number
}

export default function TotalCommissionPage() {
    const [affiliates, setAffiliates] = useState<AffiliateCommission[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateCommission | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [branchData, setBranchData] = useState<any>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setBranchData(parsed)
        }
    }, [])

    useEffect(() => {
        if (branchData?.branch) {
            loadCommissions()
        }
    }, [branchData])

    const loadCommissions = async () => {
        if (!branchData?.branch) return
        setLoading(true)
        try {
            const response = await axios.get(`/api/branch/commissions?branch=${encodeURIComponent(branchData.branch)}`)
            setAffiliates(response.data.affiliates || [])
        } catch (error) {
            console.error("Failed to fetch commissions:", error)
        } finally {
            setLoading(false)
        }
    }


    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const exportToCSV = () => {
        const headers = ["Affiliate Name", "Email", "Phone", "Referral Code", "Total Orders", "Total Commission", "Wallet Amount", "Pending Amount"]
        const rows = filteredAffiliates.map(a => [
            `${a.first_name} ${a.last_name}`,
            a.email,
            a.phone || "-",
            a.referral_code,
            a.total_orders,
            a.total_commission,
            a.wallet_amount,
            a.pending_amount
        ])

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `total-commission-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
    }

    // Calculate totals
    const totalCommissionSum = affiliates.reduce((sum, a) => sum + a.total_commission, 0)
    const totalWalletSum = affiliates.reduce((sum, a) => sum + a.wallet_amount, 0)
    const totalPendingSum = affiliates.reduce((sum, a) => sum + a.pending_amount, 0)
    const totalOrdersSum = affiliates.reduce((sum, a) => sum + a.total_orders, 0)

    // Filter affiliates based on search term
    const filteredAffiliates = affiliates.filter(affiliate => {
        const searchLower = searchTerm.toLowerCase()
        return (
            affiliate.first_name.toLowerCase().includes(searchLower) ||
            affiliate.last_name.toLowerCase().includes(searchLower) ||
            affiliate.email.toLowerCase().includes(searchLower) ||
            affiliate.referral_code.toLowerCase().includes(searchLower) ||
            (affiliate.phone && affiliate.phone.includes(searchTerm))
        )
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading commissions...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Total Commission</h1>
                    <p className="text-gray-600 mt-1">View all affiliate commissions, orders, and wallet balances</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Commission</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalCommissionSum)}</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Wallet Balance</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalWalletSum)}</p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                            <Wallet className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalPendingSum)}</p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-purple-600 mt-1">{totalOrdersSum}</p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                        Total Affiliates: <span className="font-semibold text-gray-900">{affiliates.length}</span>
                        {searchTerm && ` (Showing ${filteredAffiliates.length})`}
                    </p>
                    <input
                        type="text"
                        placeholder="Search by name, email, or referral code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-96"
                    />
                </div>

                {filteredAffiliates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p>{searchTerm ? "No affiliates found matching your search" : "No commission data available"}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Affiliate Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Referral Code
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Orders
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Commission
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Wallet Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Pending Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAffiliates.map((affiliate) => (
                                    <tr key={affiliate.user_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {affiliate.first_name} {affiliate.last_name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Code: {affiliate.referral_code}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {affiliate.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                                {affiliate.referral_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                                            {affiliate.total_orders}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                                            {formatCurrency(affiliate.total_commission)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                                            {formatCurrency(affiliate.wallet_amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-orange-600">
                                            {formatCurrency(affiliate.pending_amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedAffiliate(affiliate)}
                                                className="text-indigo-600 hover:text-indigo-900 flex items-center ml-auto"
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* View Affiliate Modal */}
            {selectedAffiliate && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-900">Affiliate Commission Details</h2>
                            <button
                                onClick={() => setSelectedAffiliate(null)}
                                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Personal Information */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Personal Information</h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Name</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedAffiliate.first_name} {selectedAffiliate.last_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Email</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedAffiliate.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Phone</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedAffiliate.phone || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Referral Code</p>
                                        <p className="text-sm font-medium text-indigo-600">{selectedAffiliate.referral_code}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Commission & Wallet Information */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Commission & Wallet</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-5 h-5 text-green-600" />
                                            <p className="text-xs text-green-700 font-semibold uppercase">Total Commission</p>
                                        </div>
                                        <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedAffiliate.total_commission)}</p>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Wallet className="w-5 h-5 text-blue-600" />
                                            <p className="text-xs text-blue-700 font-semibold uppercase">Wallet Amount</p>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedAffiliate.wallet_amount)}</p>
                                    </div>

                                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-5 h-5 text-orange-600" />
                                            <p className="text-xs text-orange-700 font-semibold uppercase">Pending Amount</p>
                                        </div>
                                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(selectedAffiliate.pending_amount)}</p>
                                    </div>

                                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShoppingBag className="w-5 h-5 text-purple-600" />
                                            <p className="text-xs text-purple-700 font-semibold uppercase">Total Orders</p>
                                        </div>
                                        <p className="text-2xl font-bold text-purple-600">{selectedAffiliate.total_orders}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Quick Stats</h3>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Average Commission per Order</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {selectedAffiliate.total_orders > 0
                                                ? formatCurrency(selectedAffiliate.total_commission / selectedAffiliate.total_orders)
                                                : "₹0.00"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Wallet Utilization</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {selectedAffiliate.total_commission > 0
                                                ? `${((selectedAffiliate.wallet_amount / selectedAffiliate.total_commission) * 100).toFixed(1)}%`
                                                : "0%"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setSelectedAffiliate(null)}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
