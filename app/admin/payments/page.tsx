"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Search, DollarSign, CreditCard, Building, User, CheckCircle, Clock, AlertCircle, Landmark, MapPin } from "lucide-react"

type BankDetails = {
    account_name: string | null
    bank_name: string | null
    bank_branch: string | null
    ifsc_code: string | null
    account_number: string | null
}

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
    bankDetails?: BankDetails
    profileCompleted?: boolean
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
    const [bankPrefilled, setBankPrefilled] = useState(false)

    // TDS State
    const [tdsPercentage, setTdsPercentage] = useState(18)
    const [grossAmount, setGrossAmount] = useState(0)
    const [tdsDeduction, setTdsDeduction] = useState(0)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [adminsRes, paymentsRes, tdsRes] = await Promise.all([
                axios.get("/api/admin/payments/admins"),
                axios.get("/api/admin/payments"),
                axios.get("/api/admin/tds-settings")
            ])

            if (adminsRes.data.success) {
                setAdmins(adminsRes.data.admins)
            }
            if (paymentsRes.data.success) {
                setPayments(paymentsRes.data.payments)
            }
            if (tdsRes.data.success) {
                setTdsPercentage(tdsRes.data.tdsPercentage || 18)
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

        if (!selectedAdmin) {
            alert("Please select an admin to pay")
            return
        }
        const net = parseFloat(amount) || 0
        if (net <= 0) {
            alert("Net payable amount must be greater than zero. This sub-admin has no outstanding earnings.")
            return
        }
        if (!transactionId.trim()) {
            alert("Transaction ID is required")
            return
        }

        setProcessing(true)
        try {
            const accountDetails = paymentMethod === "UPI"
                ? { upiId }
                : {
                    accountNumber,
                    ifscCode,
                    accountHolderName: selectedAdmin.bankDetails?.account_name || null,
                    bankName: selectedAdmin.bankDetails?.bank_name || null,
                    bankBranch: selectedAdmin.bankDetails?.bank_branch || null,
                }

            const response = await axios.post("/api/admin/payments", {
                recipientId: selectedAdmin.id,
                recipientType: selectedAdmin.type,
                recipientName: selectedAdmin.name,
                recipientEmail: selectedAdmin.email,
                amount: parseFloat(amount),
                grossAmount: grossAmount,
                tdsAmount: tdsDeduction,
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
                setGrossAmount(0)
                setTdsDeduction(0)
                setBankPrefilled(false)
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

    const handleAdminSelect = (admin: Admin) => {
        setSelectedAdmin(admin)
        const gross = admin.totalEarnings
        const tds = (gross * tdsPercentage) / 100
        const net = gross - tds

        setGrossAmount(gross)
        setTdsDeduction(tds)
        setAmount(net.toFixed(2))
        setNotes(`TDS Deducted: ₹${tds.toFixed(2)} (${tdsPercentage}%)`)

        // Auto-fill bank details from the sub-admin's stored profile data.
        // Sub-admins are bank-only (no UPI) per the complete-profile flow.
        const bd = admin.bankDetails
        setPaymentMethod("Bank Transfer")
        setAccountNumber(bd?.account_number || "")
        setIfscCode(bd?.ifsc_code || "")
        setUpiId("")
        setBankPrefilled(Boolean(bd?.account_number || bd?.ifsc_code))
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

    const netAmount = parseFloat(amount) || 0
    const hasZeroEarnings = Boolean(selectedAdmin) && netAmount <= 0
    const transactionIdMissing = !transactionId.trim()
    const canSubmit =
        Boolean(selectedAdmin) &&
        netAmount > 0 &&
        !transactionIdMissing &&
        !processing

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
                                        onClick={() => handleAdminSelect(admin)}
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
                                {/* Payment Breakdown */}
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4 border border-gray-200">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Gross Earnings:</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(grossAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-red-600">
                                        <span>TDS Deduction ({tdsPercentage}%):</span>
                                        <span className="font-medium">- {formatCurrency(tdsDeduction)}</span>
                                    </div>
                                    <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between text-base font-bold">
                                        <span className="text-gray-900">Net Payable:</span>
                                        <span className="text-indigo-600">{formatCurrency(parseFloat(amount))}</span>
                                    </div>
                                    {hasZeroEarnings && (
                                        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>
                                                This sub-admin has no outstanding earnings to pay out right now.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Amount (Net) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Payment Amount (Net Payable) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={amount}
                                            readOnly
                                            disabled
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-lg cursor-not-allowed border-indigo-200"
                                        />
                                    </div>
                                    <p className="text-xs text-indigo-600 mt-1 font-medium">
                                        ✓ Auto-calculated after deductions
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
                                    <div className="space-y-4">
                                        {(() => {
                                            const bd = selectedAdmin.bankDetails
                                            const hasAny = Boolean(
                                                bd?.account_name ||
                                                bd?.bank_name ||
                                                bd?.bank_branch ||
                                                bd?.account_number ||
                                                bd?.ifsc_code
                                            )
                                            const profileMissing =
                                                selectedAdmin.profileCompleted === false || !hasAny

                                            return (
                                                <>
                                                    {profileMissing ? (
                                                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                                            <div>
                                                                <p className="font-medium">No bank details on file</p>
                                                                <p className="text-amber-700 text-xs mt-0.5">
                                                                    This sub-admin has not completed their profile yet.
                                                                    Ask them to fill their KYC and bank details, or enter
                                                                    bank details manually below.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                                    Beneficiary Details
                                                                </p>
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                                                    <CheckCircle className="w-3 h-3" />
                                                                    From profile
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                                                <div className="flex items-center gap-2 text-gray-700">
                                                                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                                                                    <span className="truncate">
                                                                        {bd?.account_name || "—"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-gray-700">
                                                                    <Landmark className="w-4 h-4 text-gray-400 shrink-0" />
                                                                    <span className="truncate">
                                                                        {bd?.bank_name || "—"}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-gray-700">
                                                                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                                                                    <span className="truncate">
                                                                        {bd?.bank_branch || "—"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

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
                                                        {bankPrefilled && (
                                                            <p className="col-span-2 -mt-2 text-xs text-indigo-600">
                                                                Pre-filled from profile — edit if needed.
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )
                                        })()}
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
                                        Notes <span className="text-xs text-gray-500">(Auto-populated with TDS details)</span>
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
                                    disabled={!canSubmit}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : hasZeroEarnings ? (
                                        <>
                                            <AlertCircle className="w-5 h-5" />
                                            Nothing to Pay
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
