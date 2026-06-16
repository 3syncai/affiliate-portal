"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import useSWR from 'swr'
import { DollarSign, User, Users, ShoppingBag, Wallet, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"
import RecentTransactionsTable from "@/components/earnings/RecentTransactionsTable"
import { mapBmEarningsOrder } from "@/lib/transaction-display"

type DashboardUser = {
    id?: string
    city?: string
    state?: string
    refer_code?: string
}

type LiveUpdate = {
    type?: string
    amount?: number
    message?: string
}

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
    participant_branch?: string
    commission_source?: string
    type?: string
    commission_amount?: number
    your_earning?: number
    participant_earning?: number
    participant_name?: string
    status?: string
    unlock_at?: string | null
    credited_at?: string | null
    has_return?: boolean
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

const getStoredUser = (): DashboardUser | null => {
    if (typeof window === "undefined") {
        return null
    }

    const storedUser = window.localStorage.getItem("affiliate_user")
    if (!storedUser) {
        return null
    }

    try {
        return JSON.parse(storedUser) as DashboardUser
    } catch {
        return null
    }
}

export default function ASMEarningsPage() {
    const searchParams = useSearchParams()
    const listFilter = searchParams.get("filter")
    const [userData] = useState<DashboardUser | null>(() => getStoredUser())

    // Toast state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    const { data, mutate, isLoading } = useSWR(
        userData?.city && userData?.state ? `/api/asm/earnings?city=${encodeURIComponent(userData.city)}&state=${encodeURIComponent(userData.state)}${userData.id ? `&adminId=${userData.id}` : ''}` : null,
        fetcher,
        { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }
    )

    const stats = data?.success ? data.stats : {
        totalAffiliateCommissions: 0,
        totalBranchCommissions: 0,
        totalOrders: 0,
        commissionRate: 0,
        totalEarnings: 0,
        lifetimeEarnings: 0,
        creditedLifetimeEarnings: 0,
        pendingEarnings: 0,
        paidAmount: 0,
        currentEarnings: 0,
        earningsFromBranch: 0,
        earningsFromDirect: 0,
        pendingFromBranch: 0,
        pendingFromDirect: 0,
        ordersFromBranch: 0,
        ordersFromDirect: 0,
        overrideRate: 0,
        directRate: 0
    }

    const recentOrders: Order[] = data?.success ? data.recentOrders : []
    const displayedOrders = useMemo(() => {
        if (listFilter === "returns") {
            return recentOrders.filter((order) => order.has_return === true)
        }
        if (listFilter === "pending") {
            return recentOrders.filter((order) => order.status === "PENDING")
        }
        return recentOrders
    }, [recentOrders, listFilter])

    const filterLabel =
        listFilter === "returns"
            ? "Returns only"
            : listFilter === "pending"
              ? "Pending commission only"
              : null

    const transactionRows = useMemo(
        () => displayedOrders.map(mapBmEarningsOrder),
        [displayedOrders],
    )

    const loading = isLoading

    // Live updates
    const handleUpdate = useCallback((data: LiveUpdate) => {
        if (data.type === 'stats_update' || data.type === 'payment_received') {
            setToastData({
                message: data.message || "New earning activity!",
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
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>

    // Calculations for progress bar
    const totalOrders = stats.totalOrders || 1
    const branchPercent = (stats.ordersFromBranch / totalOrders) * 100
    const directPercent = 100 - branchPercent

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Branch Earning</h1>
                    <p className="text-gray-500 text-sm mt-1">Detailed breakdown of income sources from {userData?.city}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live Updates On' : 'Connecting...'}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Total Orders (White with Progress) */}
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
                                <span className="text-gray-600">{stats.ordersFromBranch} Area Orders</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></div>
                                <span className="text-gray-600">{stats.ordersFromDirect} Direct Orders</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Lifetime Earnings Card (White) */}
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
                                From Partners overrides
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
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center text-amber-600">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Pending Until Delivery
                            </div>
                            <span className="font-semibold text-amber-700">{formatCurrency(stats.pendingEarnings)}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Available to Withdraw (Dark) */}
                <div className="bg-[#0f172a] rounded-xl p-6 text-white relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Wallet className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                        <p className="text-gray-400 text-sm font-medium">Available to Withdraw</p>
                        <h2 className="text-4xl font-bold text-white mt-2">{formatCurrency(stats.currentEarnings)}</h2>

                        <div className="flex items-center mt-8 gap-4">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold flex items-center">
                                <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                Ready
                            </span>
                            <span className="text-xs text-gray-400">
                                Paid Out: <span className="text-gray-300 ml-1">{formatCurrency(stats.paidAmount)}</span>
                            </span>
                        </div>

                        {stats.pendingEarnings > 0 && (
                            <p className="text-xs text-amber-300 mt-3">
                                Pending until delivery: {formatCurrency(stats.pendingEarnings)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {filterLabel && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                    <p className="text-sm text-amber-900">
                        Showing: <span className="font-semibold">{filterLabel}</span>
                        {" "}({displayedOrders.length} record{displayedOrders.length === 1 ? "" : "s"})
                    </p>
                    <Link
                        href="/asm/earnings"
                        className="text-sm font-medium text-amber-800 hover:text-amber-950 underline shrink-0"
                    >
                        Clear filter
                    </Link>
                </div>
            )}

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-semibold text-blue-900">Earning Structure</h4>
                    <p className="text-sm text-blue-700 mt-0.5">
                        You earn in two ways: <span className="font-semibold">{stats.directRate}% commission</span> on your direct referrals, plus <span className="font-semibold"> {stats.overrideRate}% override</span> on total sales volume from area in your branches.
                    </p>
                </div>
            </div>

            <RecentTransactionsTable
                orders={transactionRows}
                emptyMessage="No transactions found."
                filterLabel={filterLabel}
            />
        </div>
    )
}
