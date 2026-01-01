"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Search, DollarSign, CreditCard, Building, User, CheckCircle, Clock, AlertCircle } from "lucide-react"

type Admin = {
    id: string
    name: string
    email: string
    type: string
    typeLabel: string
    location: string
    city: string | null
    state: string
    totalSales: number
    commissionRate: number
    totalEarnings: number
}

type Payment = {
    id: string
    recipient_name: string
    recipient_type: string
    amount: number
    transaction_id: string
    payment_method: string
    payment_date: string
    status: string
}

export default function PaymentsPage() {
    const [admins, setAdmins] = useState<Admin[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    // Form state
    const [amount, setAmount] = useState("")
    const [transactionId, setTransactionId] = useState("")
    const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
    const [accountNumber, setAccountNumber] = useState("")
    const [ifscCode, setIfscCode] = useState("")
    const [upiId, setUpiId] = useState("")
    const [notes, setNotes] = useState("")

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [adminsRes, paymentsRes] = await Promise.all([
                axios.get("/api/admin/payments/admins"),
                axios.get("/api/admin/payments")
            ])

            if (adminsRes.data.success) {
                setAdmins(adminsRes.data.admins)
            }
            if (paymentsRes.data.success) {
                setPayments(paymentsRes.data.payments)
            }
        } catch (error) {
            console.error("Failed to fetch data:", error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAdmins = admins.filter(admin =>
        admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.location.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedAdmin || !amount || !transactionId) {
            alert("Please fill in all required fields")
            return
        }

        setProcessing(true)
        try {
            const accountDetails = paymentMethod === "UPI"
                ? { upiId }
                : { accountNumber, ifscCode }

            const response = await axios.post("/api/admin/payments", {
                recipientId: selectedAdmin.id,
                recipientType: selectedAdmin.type,
                recipientName: selectedAdmin.name,
                recipientEmail: selectedAdmin.email,
                amount: parseFloat(amount),
                transactionId,
                paymentMethod,
                accountDetails,
                notes
            })

            if (response.data.success) {
                alert("Payment processed successfully! Notification sent to recipient.")
                // Reset form
                setSelectedAdmin(null)
                setAmount("")
                setTransactionId("")
                setAccountNumber("")
                setIfscCode("")
                setUpiId("")
                setNotes("")
                setSearchTerm("")
                // Refresh data
                fetchData()
            }
        } catch (error: any) {
            console.error("Payment failed:", error)
            alert("Failed to process payment: " + (error.response?.data?.error || error.message))
        } finally {
            setProcessing(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-medium text-gray-600">Loading payment data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Payments</h1>
                <p className="text-gray-600 mt-1">Process payments to Branch, ASM, and State admins</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Payment Form - Left Side */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Admin Selection */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Admin to Pay</h2>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, email, or location..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Admin List */}
                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {filteredAdmins.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No admins found</p>
                            ) : (
                                filteredAdmins.map((admin) => (
                                    <button
                                        key={admin.id}
                                        onClick={() => {
                                            setSelectedAdmin(admin)
                                            setAmount(admin.totalEarnings.toFixed(2))
                                        }}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedAdmin?.id === admin.id
                                                ? "border-indigo-500 bg-indigo-50"
                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-gray-900">{admin.name}</p>
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                        {admin.typeLabel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{admin.email}</p>
                                                <p className="text-xs text-gray-500 mt-1">📍 {admin.location}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                                                <p className="text-lg font-bold text-green-600">{formatCurrency(admin.totalEarnings)}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Payment Form */}
                    {selectedAdmin && (
                        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>

                            <div className="space-y-4">
                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Amount (Total Earnings) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formatCurrency(parseFloat(amount || "0"))}
                                            readOnly
                                            disabled
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-xs text-green-600 mt-1 font-medium">
                                        ✓ Auto-calculated based on admin's total earnings
                                    </p>
                                </div>

                                {/* Transaction ID */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Transaction ID <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        required
                                        placeholder="Enter bank/UPI transaction reference"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Payment Method
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Cash">Cash</option>
                                    </select>
                                </div>

                                {/* Account Details */}
                                {paymentMethod === "Bank Transfer" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Account Number
                                            </label>
                                            <input
                                                type="text"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                placeholder="Account number"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                IFSC Code
                                            </label>
                                            <input
                                                type="text"
                                                value={ifscCode}
                                                onChange={(e) => setIfscCode(e.target.value)}
                                                placeholder="IFSC code"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === "UPI" && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            UPI ID
                                        </label>
                                        <input
                                            type="text"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                            placeholder="example@upi"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Additional notes about this payment..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            Process Payment
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Payment History - Right Side */}
                <div className="xl:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 xl:sticky xl:top-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h2>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {payments.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No payments yet</p>
                            ) : (
                                payments.slice(0, 10).map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900 text-sm">{payment.recipient_name}</p>
                                                <p className="text-xs text-gray-500 capitalize">{payment.recipient_type} Admin</p>
                                            </div>
                                            {payment.status === 'completed' && (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                                            <p className="text-xs text-gray-500">{formatDate(payment.payment_date)}</p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">TXN: {payment.transaction_id}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
