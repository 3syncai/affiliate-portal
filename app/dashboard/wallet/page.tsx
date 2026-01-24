"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import { Wallet, CreditCard, Building2, Smartphone, Plus, Edit2, CheckCircle, TrendingUp, History, ArrowUpRight, Copy, Wifi, WifiOff } from "lucide-react"
import UserNavbar from "../../components/UserNavbar"
import { useSSE } from "@/hooks/useSSE"
import { Toast } from "@/components/Toast"

type PaymentMethod = {
    method: string
    bank?: {
        name: string
        branch: string
        ifscCode: string
        accountName: string
        accountNumber: string
    } | null
    upi?: {
        id: string
    } | null
}

type WalletData = {
    user: {
        id: number
        name: string
        email: string
        referCode: string
    }
    balance: {
        current: number
        totalEarned: number
        withdrawn: number
    }
    paymentMethod: PaymentMethod | null
}

export default function WalletPage() {
    const [walletData, setWalletData] = useState<WalletData | null>(null)
    const [loading, setLoading] = useState(true)
    const [showSetupModal, setShowSetupModal] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<'bank' | 'upi'>('bank')
    const [saving, setSaving] = useState(false)
    const [userName, setUserName] = useState<string>("")

    // Withdrawal states
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [tdsPercentage, setTdsPercentage] = useState(18)
    const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)
    const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [referCode, setReferCode] = useState<string>("")

    // Toast notification state
    const [showToast, setShowToast] = useState(false)
    const [toastData, setToastData] = useState<{ message: string; amount?: number }>({ message: "" })

    // SSE Real-time updates
    const handlePaymentReceived = useCallback((data: any) => {
        console.log("Payment received!", data);
        setToastData({
            message: data.message || "Payment received!",
            amount: data.amount
        });
        setShowToast(true);

        // Refresh wallet data
        if (referCode) {
            fetchWalletData(referCode);
            fetchWithdrawalHistory(referCode);
        }
    }, [referCode]);

    const { isConnected } = useSSE({
        affiliateCode: referCode,
        onPaymentReceived: handlePaymentReceived
    });

    // Form state
    const [bankForm, setBankForm] = useState({
        accountName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branch: ''
    })
    const [upiForm, setUpiForm] = useState({
        upiId: ''
    })

    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem("affiliate_token")
        const userData = localStorage.getItem("affiliate_user")

        if (!token || !userData) {
            window.location.href = "/login"
            return
        }

        try {
            const parsedUser = JSON.parse(userData)

            if (!parsedUser.is_approved) {
                window.location.href = "/verification-pending"
                return
            }

            // Set user name
            setUserName(parsedUser.name || parsedUser.email)

            // Fetch wallet data with actual refer code
            if (parsedUser.refer_code) {
                setReferCode(parsedUser.refer_code)
                fetchWalletData(parsedUser.refer_code)
                fetchTDSSettings()
                fetchWithdrawalHistory(parsedUser.refer_code)
            }
        } catch (e) {
            console.error("Error parsing user data:", e)
            window.location.href = "/login"
        }
    }, [])

    const fetchWalletData = async (referCode: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/affiliate/wallet?refer_code=${referCode}`)
            const data = response.data
            if (data.success) {
                setWalletData(data.data)
            } else {
                console.error('Wallet API error:', data.error)
            }
        } catch (error) {
            console.error('Failed to fetch wallet data:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTDSSettings = async () => {
        try {
            const response = await axios.get('/api/admin/tds-settings')
            const data = response.data
            if (data.success) {
                setTdsPercentage(data.tdsPercentage || 18)
            }
        } catch (error) {
            console.error('Failed to fetch TDS settings:', error)
        }
    }

    const calculateWithdrawal = () => {
        const amount = parseFloat(withdrawAmount) || 0
        const tdsAmount = (amount * tdsPercentage) / 100
        const netPayable = amount - tdsAmount
        return {
            withdrawalAmount: amount,
            tdsAmount,
            netPayable
        }
    }

    const fetchWithdrawalHistory = async (referCode: string) => {
        setLoadingHistory(true)
        try {
            const response = await axios.get(`/api/affiliate/withdrawal/history?refer_code=${referCode}`)
            const data = response.data
            if (data.success) {
                setWithdrawalHistory(data.withdrawals)
            }
        } catch (error) {
            console.error('Failed to fetch withdrawal history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: 'bg-amber-100 text-amber-700',
            APPROVED: 'bg-blue-100 text-blue-700',
            REJECTED: 'bg-red-100 text-red-700',
            PAID: 'bg-green-100 text-green-700'
        }
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const maskAccountNumber = (accountNumber: string) => {
        if (!accountNumber || accountNumber.length < 4) return accountNumber
        return 'XXXX-XXXX-' + accountNumber.slice(-4)
    }

    const savePaymentMethod = async () => {
        setSaving(true)
        try {
            const userData = localStorage.getItem("affiliate_user")
            if (!userData) {
                alert('User session not found')
                return
            }

            const parsedUser = JSON.parse(userData)
            const referCode = parsedUser.refer_code

            let requestBody: any = {
                referCode,
                paymentMethod: selectedMethod === 'bank' ? 'Bank Transfer' : 'UPI'
            }

            if (selectedMethod === 'bank') {
                // Validate bank form
                if (!bankForm.accountName || !bankForm.accountNumber || !bankForm.ifscCode) {
                    alert('Please fill in all required bank details')
                    setSaving(false)
                    return
                }
                requestBody.bankDetails = bankForm
            } else {
                // Validate UPI form
                if (!upiForm.upiId) {
                    alert('Please enter your UPI ID')
                    setSaving(false)
                    return
                }
                requestBody.upiDetails = upiForm
            }

            const response = await axios.put('/api/affiliate/payment-method', requestBody)
            const data = response.data
            if (data.success) {
                alert('Payment method saved successfully!')
                setShowSetupModal(false)
                // Refresh wallet data
                if (referCode) {
                    await fetchWalletData(referCode)
                }
            } else {
                alert('Failed to save: ' + (data.error || 'Unknown error'))
            }
        } catch (error: any) {
            console.error('Save error:', error)
            alert('An error occurred while saving: ' + (error.response?.data?.error || error.message))
        } finally {
            setSaving(false)
        }
    }

    const submitWithdrawal = async () => {
        if (!walletData) return

        const calc = calculateWithdrawal()
        if (calc.withdrawalAmount < 20) {
            alert('Minimum withdrawal amount is ₹20')
            return
        }

        setSubmittingWithdrawal(true)
        try {
            const userData = localStorage.getItem("affiliate_user")
            if (!userData) {
                alert('User session not found')
                return
            }

            const parsedUser = JSON.parse(userData)

            const requestBody = {
                referCode: parsedUser.refer_code,
                withdrawalAmount: calc.withdrawalAmount,
                tdsPercentage,
                tdsAmount: calc.tdsAmount,
                netPayable: calc.netPayable,
                paymentMethod: walletData.paymentMethod?.method,
                bankDetails: walletData.paymentMethod?.bank,
                upiDetails: walletData.paymentMethod?.upi,
                walletBalance: walletData.balance.current
            }

            const response = await axios.post('/api/affiliate/withdrawal/request', requestBody)
            const data = response.data
            if (data.success) {
                alert('✅ Withdrawal request submitted successfully!\n\n💰 Payment will be credited to your registered bank account/UPI within 5-7 business days after admin approval.')
                setShowWithdrawModal(false)
                setWithdrawAmount("")
                // Refresh wallet data
                await fetchWalletData(parsedUser.refer_code)
                await fetchWithdrawalHistory(parsedUser.refer_code)
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'))
            }
        } catch (error: any) {
            console.error('Withdrawal error:', error)
            alert('An error occurred: ' + (error.response?.data?.error || error.message))
        } finally {
            setSubmittingWithdrawal(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading wallet...</div>
            </div>
        )
    }

    if (!walletData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-red-500">Failed to load wallet data</div>
            </div>
        )
    }

    return (
        <>
            <UserNavbar userName={userName} />

            {/* Real-time Connection Indicator */}
            <div className="fixed bottom-4 left-4 z-50">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isConnected ? 'Live Updates On' : 'Connecting...'}
                </div>
            </div>

            {/* Payment Received Toast */}
            {showToast && (
                <Toast
                    message={toastData.message}
                    type="payment"
                    amount={toastData.amount}
                    onClose={() => setShowToast(false)}
                />
            )}

            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header Section */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent mb-1">
                                Wallet & Earnings
                            </h1>
                            <p className="text-gray-600 text-sm">Manage your payouts and payment methods</p>
                        </div>
                        {walletData.paymentMethod && walletData.balance.current >= 20 && (
                            <button
                                onClick={() => setShowWithdrawModal(true)}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2 rounded-xl font-semibold shadow-lg shadow-emerald-200 transition-all duration-300 hover:scale-105 flex items-center gap-2 text-sm"
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                Withdraw Funds
                            </button>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Available Balance Card - HERO */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group hover:shadow-emerald-300 transition-shadow duration-300">
                            {/* Coin Background Decoration */}
                            <div className="absolute inset-0 opacity-40">
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 w-72 h-72">
                                    <img
                                        src="/uploads/coin/coin.png"
                                        alt="Coin decoration"
                                        className="w-full h-full object-contain opacity-80 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700"
                                    />
                                </div>
                            </div>

                            <div className="relative z-10">
                            </div>

                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/30">
                        <div className="bg-white/15 backdrop-blur-md rounded-xl p-3 hover:bg-white/20 transition-all">
                            <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-100" />
                                <p className="text-xs text-emerald-100 font-medium">Total Earned</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(walletData.balance.totalEarned)}</p>
                            <p className="text-xs text-emerald-200 mt-0.5">Lifetime</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-md rounded-xl p-3 hover:bg-white/20 transition-all">
                            <div className="flex items-center gap-1.5 mb-1">
                                <History className="w-3.5 h-3.5 text-emerald-100" />
                                <p className="text-xs text-emerald-100 font-medium">Withdrawn</p>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(walletData.balance.withdrawn)}</p>
                            <p className="text-xs text-emerald-200 mt-0.5">Paid out</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Quick Stats</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all cursor-pointer">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg shadow-lg">
                                <TrendingUp className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <span className="text-xs font-medium text-gray-500 block">Earnings</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(walletData.balance.totalEarned)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all cursor-pointer">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-2 rounded-lg shadow-lg">
                                <History className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <span className="text-xs font-medium text-gray-500 block">Paid Out</span>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(walletData.balance.withdrawn)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all cursor-pointer">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg shadow-lg">
                                <Wallet className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <span className="text-xs font-medium text-gray-500 block">Available</span>
                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(walletData.balance.current)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Payment Method Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                                <CreditCard className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Payment Method</h3>
                                <p className="text-gray-600 text-xs mt-0.5">Your default payout destination</p>
                            </div>
                        </div>
                        {walletData.paymentMethod && (
                            <button
                                onClick={() => setShowSetupModal(true)}
                                className="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-emerald-50 transition-all duration-200 border border-emerald-200 hover:border-emerald-300 text-sm"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    {walletData.paymentMethod ? (
                        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-xl border-2 border-gray-100 hover:border-emerald-200 transition-all">
                            {walletData.paymentMethod.method === 'Bank Transfer' ? (
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-xl">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl shadow-xl">
                                    <Smartphone className="w-6 h-6 text-white" />
                                </div>
                            )}

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold text-gray-900 text-base">
                                        {walletData.paymentMethod.method}
                                    </p>
                                    <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold shadow-lg">
                                        ✓ Verified
                                    </span>
                                </div>

                                {walletData.paymentMethod.method === 'Bank Transfer' ? (
                                    <p className="text-gray-600 text-sm font-medium">
                                        {walletData.paymentMethod.bank?.name} • {maskAccountNumber(walletData.paymentMethod.bank?.accountNumber || '')}
                                    </p>
                                ) : (
                                    <p className="text-gray-600 text-sm font-mono font-semibold">
                                        {walletData.paymentMethod.upi?.id}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                                <Plus className="w-8 h-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 mb-2">No Payment Method Added</h4>
                            <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">Add your bank account or UPI ID to receive withdrawal payments</p>
                            <button
                                onClick={() => setShowSetupModal(true)}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2 rounded-xl font-semibold shadow-lg shadow-emerald-200 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Setup Payment Method
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal History */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                <div className="bg-gradient-to-r from-gray-50 to-white p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-2.5 rounded-xl shadow-lg">
                            <History className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Withdrawal History</h3>
                            <p className="text-gray-600 text-xs mt-0.5">Track all your withdrawal requests</p>
                        </div>
                    </div>
                </div>

                {
                    loadingHistory ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full mx-auto mb-3"></div>
                            <p className="font-medium text-sm">Loading history...</p>
                        </div>
                    ) : withdrawalHistory.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-base font-medium">No withdrawal requests found</p>
                            <p className="text-sm mt-1">Your withdrawal history will appear here</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {withdrawalHistory.map((withdrawal) => (
                                <div key={withdrawal.id} className="p-4 hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl shadow-lg ${withdrawal.status === 'PAID' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                                                withdrawal.status === 'REJECTED' ? 'bg-gradient-to-br from-red-500 to-pink-600' :
                                                    withdrawal.status === 'APPROVED' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                                        'bg-gradient-to-br from-amber-500 to-orange-600'
                                                }`}>
                                                {withdrawal.status === 'PAID' ? <CheckCircle className="w-5 h-5 text-white" /> :
                                                    <Wallet className="w-5 h-5 text-white" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-base">Request #{withdrawal.id}</p>
                                                <p className="text-gray-500 text-xs font-medium">{formatDate(withdrawal.requested_at)}</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold tracking-wider uppercase shadow-md ${getStatusBadge(withdrawal.status)}`}>
                                            {withdrawal.status}
                                        </span>
                                    </div>

                                    <div className="bg-gradient-to-r from-gray-50 to-transparent rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 border border-gray-100">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Amount</p>
                                            <p className="font-bold text-gray-900 text-sm">{formatCurrency(withdrawal.withdrawal_amount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">TDS ({tdsPercentage}%)</p>
                                            <p className="font-bold text-red-600 text-sm">-{formatCurrency(withdrawal.gst_amount || withdrawal.tds_amount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Net Payout</p>
                                            <p className="font-bold text-emerald-600 text-sm">{formatCurrency(withdrawal.net_payable)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Method</p>
                                            <p className="font-semibold text-gray-700 text-sm truncate">{withdrawal.payment_method}</p>
                                        </div>
                                    </div>

                                    {/* Transaction Details */}
                                    {withdrawal.status === 'PAID' && withdrawal.transaction_id && (
                                        <div className="mt-3 flex items-center gap-2 text-xs bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-xl border-2 border-green-200">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span className="font-bold text-green-700">Paid on {formatDate(withdrawal.payment_date || withdrawal.reviewed_at)}</span>
                                            <span className="text-gray-400 mx-1">|</span>
                                            <span className="font-mono font-semibold text-gray-700">{withdrawal.transaction_id}</span>
                                        </div>
                                    )}

                                    {/* Rejection Details */}
                                    {withdrawal.status === 'REJECTED' && withdrawal.admin_notes && (
                                        <div className="mt-3 text-xs bg-gradient-to-r from-red-50 to-pink-50 p-3 rounded-xl border-2 border-red-200">
                                            <span className="font-bold text-red-700 block mb-1">Rejection Reason:</span>
                                            <p className="text-red-600">{withdrawal.admin_notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>

            {showSetupModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-2xl font-bold text-gray-900">
                                {walletData.paymentMethod ? 'Edit Payment Method' : 'Setup Payment Method'}
                            </h3>
                        </div>

                        <div className="p-6">
                            {/* Method Selector */}
                            <div className="mb-6">
                                <p className="text-sm font-medium text-gray-700 mb-3">Select Payment Method</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setSelectedMethod('bank')}
                                        className={`p-4 border-2 rounded-lg transition-all ${selectedMethod === 'bank'
                                            ? 'border-emerald-600 bg-emerald-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Building2 className={`w-8 h-8 mx-auto mb-2 ${selectedMethod === 'bank' ? 'text-emerald-600' : 'text-gray-400'
                                            }`} />
                                        <p className="font-semibold text-gray-900">Bank Transfer</p>
                                    </button>

                                    <button
                                        onClick={() => setSelectedMethod('upi')}
                                        className={`p-4 border-2 rounded-lg transition-all ${selectedMethod === 'upi'
                                            ? 'border-emerald-600 bg-emerald-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Smartphone className={`w-8 h-8 mx-auto mb-2 ${selectedMethod === 'upi' ? 'text-emerald-600' : 'text-gray-400'
                                            }`} />
                                        <p className="font-semibold text-gray-900">UPI</p>
                                    </button>
                                </div>
                            </div>

                            {/* Bank Form */}
                            {selectedMethod === 'bank' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                                        <input type="text" value={bankForm.accountName} onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Account Holder Name" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                                        <input type="text" value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Account Number" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                                        <input type="text" value={bankForm.ifscCode} onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="IFSC Code" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                                        <input type="text" value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Bank Name" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                                        <input type="text" value={bankForm.branch} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Branch Name" />
                                    </div>
                                </div>
                            )}

                            {/* UPI Form */}
                            {selectedMethod === 'upi' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                                    <input type="text" value={upiForm.upiId} onChange={(e) => setUpiForm({ upiId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="yourname@upi" />
                                    <p className="text-sm text-gray-500 mt-2">Enter your UPI ID (e.g., yourname@paytm, yourname@gpay)</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowSetupModal(false)}
                                className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button onClick={savePaymentMethod} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? 'Saving...' : 'Save Payment Method'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Withdrawal Request Modal */}
            {
                showWithdrawModal && walletData && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-lg w-full">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-2xl font-bold text-gray-900">Request Withdrawal</h3>
                                <p className="text-sm text-gray-600 mt-1">Enter the amount you want to withdraw</p>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Amount Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Withdrawal Amount
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">â‚¹</span>
                                        <input
                                            type="number"
                                            min="20"
                                            max={walletData.balance.current}
                                            step="0.01"
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>Min: â‚¹20</span>
                                        <button
                                            onClick={() => setWithdrawAmount(walletData.balance.current.toString())}
                                            className="text-emerald-600 hover:text-emerald-700 font-medium"
                                        >
                                            Max: {formatCurrency(walletData.balance.current)}
                                        </button>
                                    </div>
                                </div>

                                {/* GST Calculation Breakdown */}
                                {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                        <h4 className="font-semibold text-gray-900 text-sm mb-3">Withdrawal Breakdown</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Withdrawal Amount:</span>
                                                <span className="font-medium text-gray-900">{formatCurrency(calculateWithdrawal().withdrawalAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-red-600">
                                                <span>TDS Deduction ({tdsPercentage}%):</span>
                                                <span className="font-medium">- {formatCurrency(calculateWithdrawal().tdsAmount)}</span>
                                            </div>
                                            <div className="border-t border-gray-300 pt-2 mt-2">
                                                <div className="flex justify-between text-base">
                                                    <span className="font-semibold text-gray-900">You will receive:</span>
                                                    <span className="font-bold text-emerald-600 text-lg">{formatCurrency(calculateWithdrawal().netPayable)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Method Info */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-900 font-medium mb-1">Payment Method:</p>
                                    <p className="text-sm text-blue-700">
                                        {walletData.paymentMethod?.method === 'Bank Transfer'
                                            ? `Bank Transfer - ${walletData.paymentMethod.bank?.accountNumber?.slice(-4)}`
                                            : `UPI - ${walletData.paymentMethod?.upi?.id}`
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowWithdrawModal(false)
                                        setWithdrawAmount("")
                                    }}
                                    className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitWithdrawal}
                                    disabled={!withdrawAmount || parseFloat(withdrawAmount) < 20 || parseFloat(withdrawAmount) > walletData.balance.current || submittingWithdrawal}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </>
    )
}
