"use client"

import { useEffect, useState } from "react"
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, ChevronRight, DollarSign, Target, Award, PieChart, LucideIcon } from "lucide-react"
import axios from "axios"

interface Transaction {
    id: string
    type: "DIRECT" | "OVERRIDE" | "WITHDRAWAL"
    description: string
    amount: number
    date: string
    status: "PENDING" | "CREDITED" | "COMPLETED" | "PAID" | "REJECTED"
}

interface EarningsData {
    lifetime: number
    monthly: number
    currentBalance: number
    pendingAmount: number
    teamEarnings?: number
}

export default function BranchEarningsPage() {
    const [earnings, setEarnings] = useState<EarningsData>({
        lifetime: 0,
        monthly: 0,
        currentBalance: 0,
        pendingAmount: 0
    })
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadEarnings()
    }, [])

    const loadEarnings = async () => {
        try {
            const userData = localStorage.getItem("affiliate_user")
            if (!userData) return
            const user = JSON.parse(userData)

            const response = await axios.get(`/api/branch/earnings?branchId=${user.id}`)
            if (response.data.success) {
                setEarnings(response.data.earnings)
                setTransactions(response.data.recentTransactions || [])
            }
        } catch (error) {
            console.error("Failed to load earnings:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount)
    }

    const StatCard = ({ title, value, icon: Icon, color, subtitle }: {
        title: string;
        value: number;
        icon: LucideIcon;
        color: string;
        subtitle?: string;
    }) => (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</h3>
                    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Branch Earnings</h1>
                    <p className="text-gray-500">Track branch income and performance</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                    <DollarSign className="w-4 h-4" />
                    Request Payout
                </button>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Current Balance"
                    value={earnings.currentBalance}
                    icon={Wallet}
                    color="blue"
                    subtitle="Available for payout"
                />
                <StatCard
                    title="Pending Amount"
                    value={earnings.pendingAmount}
                    icon={Clock}
                    color="amber"
                    subtitle="Awaiting processing"
                />
                <StatCard
                    title="Monthly Income"
                    value={earnings.monthly}
                    icon={Target}
                    color="emerald"
                    subtitle="This month's revenue"
                />
                <StatCard
                    title="Lifetime Revenue"
                    value={earnings.lifetime}
                    icon={Award}
                    color="violet"
                    subtitle="Total earned in branch"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Transactions */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">Recent Branch Activity</h2>
                        <button className="text-sm text-blue-600 font-medium hover:underline">View All</button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-sm">
                        {transactions.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {transactions.map((tx, idx) => (
                                    <div key={tx.id || idx} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'WITHDRAWAL' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                                }`}>
                                                {tx.type === 'WITHDRAWAL' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{tx.description}</p>
                                                <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${tx.type === 'WITHDRAWAL' ? 'text-red-600' : 'text-green-600'}`}>
                                                {tx.type === 'WITHDRAWAL' ? '-' : '+'}{formatCurrency(tx.amount)}
                                            </p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tx.status === 'COMPLETED' || tx.status === 'PAID' || tx.status === 'CREDITED' ? 'bg-green-100 text-green-700' :
                                                    tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {tx.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-400">
                                <PieChart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No branch transactions found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Growth Sidebar */}
                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-gray-900">Branch Performance</h2>
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-xl shadow-emerald-200">
                        <div className="flex items-center justify-between mb-4">
                            <TrendingUp className="w-8 h-8 opacity-50" />
                            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Monthly Target</span>
                        </div>
                        <p className="text-emerald-100 text-sm">Revenue Goal Target</p>
                        <h3 className="text-3xl font-bold mb-4">84%</h3>
                        <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                            <div className="bg-white h-full" style={{ width: '84%' }}></div>
                        </div>
                        <p className="text-xs text-emerald-100 mt-4 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            +15% from last month
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-4">Quick Branch Insights</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Active Agents</span>
                                <span className="font-semibold">68</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Approved Payouts</span>
                                <span className="font-semibold text-emerald-600">₹45,200</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Top Performing Agent</span>
                                <span className="font-semibold">Rahul K.</span>
                            </div>
                            <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors border border-blue-100">
                                Branch Analysis
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
