"use client"

import { useState, useEffect } from 'react'
import { Users, TrendingUp, ShoppingBag, IndianRupee, Copy, Check } from 'lucide-react'

interface ReferralStats {
    totalReferrals: number
    totalOrders: number
    totalOrderValue: number
    totalCommission: number
}

interface Referral {
    id: string
    customer_email: string
    customer_name: string
    total_orders: number
    total_order_value: number
    total_commission: number
    created_at: string
    first_order_at?: string
}

interface Commission {
    id: string
    order_id: string
    product_name: string
    order_amount: number
    commission_amount: number
    affiliate_commission: number
    affiliate_rate: number
    customer_name: string
    status: string
    created_at: string
}

export default function MyReferralsPage() {
    const [stats, setStats] = useState<ReferralStats | null>(null)
    const [referrals, setReferrals] = useState<Referral[]>([])
    const [commissions, setCommissions] = useState<Commission[]>([])
    const [loading, setLoading] = useState(true)
    const [referCode, setReferCode] = useState<string>('')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        // Get refer code from user object in localStorage
        const userData = localStorage.getItem('affiliate_user')
        if (userData) {
            try {
                const user = JSON.parse(userData)
                if (user.refer_code) {
                    setReferCode(user.refer_code)
                    fetchReferrals(user.refer_code)
                } else {
                    setLoading(false)
                }
            } catch (error) {
                console.error('Failed to parse user data:', error)
                setLoading(false)
            }
        } else {
            setLoading(false)
        }
    }, [])

    const fetchReferrals = async (code: string) => {
        try {
            const response = await fetch(`/api/branch/referrals?referCode=${code}`)
            const data = await response.json()

            if (data.success) {
                setStats(data.stats)
                setReferrals(data.referrals || [])
                setCommissions(data.recentCommissions || [])
            }
        } catch (error) {
            console.error('Failed to fetch referrals:', error)
        } finally {
            setLoading(false)
        }
    }

    const copyReferralCode = () => {
        if (referCode) {
            navigator.clipboard.writeText(referCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Loading referrals...</div>
            </div>
        )
    }

    if (!referCode) {
        return (
            <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">No referral code found. Please contact support.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">My Referrals</h1>
                <p className="text-gray-600">Track customers you've referred and your commissions</p>
            </div>

            {/* Referral Code Card */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 mb-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-green-100 text-sm mb-1">Your Referral Code</p>
                        <p className="text-3xl font-bold mb-2">{referCode}</p>
                        <p className="text-green-100 text-sm">Share this code to earn 85% commission on sales</p>
                    </div>
                    <button
                        onClick={copyReferralCode}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-600 text-sm">Total Referrals</p>
                            <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-600 text-sm">Total Orders</p>
                            <ShoppingBag className="w-5 h-5 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-600 text-sm">Order Value</p>
                            <TrendingUp className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            ₹{stats.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-600 text-sm">Total Commission</p>
                            <IndianRupee className="w-5 h-5 text-orange-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            ₹{stats.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            )}

            {/* Referrals List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Referred Customers</h2>
                </div>
                <div className="overflow-x-auto">
                    {referrals.length > 0 ? (
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Value</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {referrals.map((referral) => (
                                    <tr key={referral.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900">{referral.customer_name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{referral.customer_email}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{referral.total_orders}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            ₹{referral.total_order_value.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-green-600">
                                            ₹{referral.total_commission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(referral.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No referrals yet. Start sharing your referral code!
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Commissions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Commissions</h2>
                </div>
                <div className="overflow-x-auto">
                    {commissions.length > 0 ? (
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {commissions.map((commission) => (
                                    <tr key={commission.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{commission.order_id.substring(0, 8)}...</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{commission.product_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{commission.customer_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            ₹{commission.order_amount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-blue-600">{commission.affiliate_rate}%</td>
                                        <td className="px-6 py-4 text-sm font-medium text-green-600">
                                            ₹{commission.affiliate_commission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${commission.status === 'CREDITED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {commission.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(commission.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No commissions earned yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
