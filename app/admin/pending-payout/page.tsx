"use client"

import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import { Check, X, Copy, CreditCard } from "lucide-react"

type Withdrawal = {
  id: number
  affiliate_name: string
  affiliate_email: string
  affiliate_code: string
  withdrawal_amount: number
  gst_percentage: number
  gst_amount: number
  net_payable: number
  payment_method: string
  bank_name?: string
  ifsc_code?: string
  account_name?: string
  account_number?: string
  upi_id?: string
  status: string
  requested_at: string
  transaction_id?: string
  payment_date?: string
  payment_details?: string
}

export default function PendingPayoutPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("ALL")
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [transactionForm, setTransactionForm] = useState({
    transactionId: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentDetails: ""
  })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchWithdrawals()
  }, [filter])

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === "ALL"
        ? '/api/admin/withdrawals'
        : `/api/admin/withdrawals?status=${filter}`

      const response = await axios.get(url)
      const data = response.data
      if (data.success) {
        setWithdrawals(data.withdrawals)
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const handleApprove = async (withdrawalId: number) => {
    if (!confirm('Are you sure you want to approve this withdrawal request?\n\nThis will deduct the amount from affiliate\'s wallet.')) {
      return
    }

    setProcessing(true)
    try {
      await axios.post('/api/admin/withdrawals', {
        withdrawalId,
        action: 'APPROVE',
        adminNotes: 'Approved for payment'
      })
      alert('✅ Withdrawal approved! Amount deducted from wallet.\n\nNow you can mark it as paid after transferring money.')
      fetchWithdrawals()
    } catch (error) {
      console.error('Approve error:', error)
      alert('An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (withdrawalId: number) => {
    const reason = prompt('Enter reason for rejection (optional):')
    if (reason === null) return

    setProcessing(true)
    try {
      await axios.post('/api/admin/withdrawals', {
        withdrawalId,
        action: 'REJECT',
        adminNotes: reason || 'Rejected'
      })
      alert('Withdrawal rejected')
      fetchWithdrawals()
    } catch (error) {
      console.error('Reject error:', error)
      alert('An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!transactionForm.transactionId.trim()) {
      alert('Please enter transaction ID')
      return
    }

    setProcessing(true)
    try {
      await axios.post('/api/admin/withdrawals/mark-paid', {
        withdrawalId: selectedWithdrawal?.id,
        ...transactionForm
      })
      alert('✅ Payment marked as completed!')
      setShowPaidModal(false)
      setTransactionForm({ transactionId: "", paymentDate: new Date().toISOString().split('T')[0], paymentDetails: "" })
      fetchWithdrawals()
    } catch (error) {
      console.error('Mark paid error:', error)
      alert('An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    alert(`${label} copied to clipboard!`)
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Withdrawal Requests</h1>
        <p className="text-gray-600 mt-1">Manage affiliate withdrawal requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${filter === tab
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Withdrawals List */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No withdrawal requests found
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => (
            <div key={withdrawal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{withdrawal.affiliate_name}</h3>
                  <p className="text-sm text-gray-600">{withdrawal.affiliate_email}</p>
                  <p className="text-xs text-gray-500 mt-1">Code: {withdrawal.affiliate_code}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(withdrawal.status)}`}>
                  {withdrawal.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Withdrawal Amount</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(withdrawal.withdrawal_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">GST Deduction ({withdrawal.gst_percentage}%)</p>
                  <p className="text-lg font-semibold text-red-600">-{formatCurrency(withdrawal.gst_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Payable</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(withdrawal.net_payable)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(withdrawal.requested_at)}</p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Payment Method: {withdrawal.payment_method}</p>

                {withdrawal.payment_method === 'Bank Transfer' && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Account Holder:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{withdrawal.account_name}</span>
                        <button onClick={() => copyToClipboard(withdrawal.account_name!, 'Account name')} className="text-indigo-600 hover:text-indigo-700">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Account Number:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{withdrawal.account_number}</span>
                        <button onClick={() => copyToClipboard(withdrawal.account_number!, 'Account number')} className="text-indigo-600 hover:text-indigo-700">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">IFSC Code:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{withdrawal.ifsc_code}</span>
                        <button onClick={() => copyToClipboard(withdrawal.ifsc_code!, 'IFSC code')} className="text-indigo-600 hover:text-indigo-700">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Bank Name:</span>
                      <span className="font-medium">{withdrawal.bank_name}</span>
                    </div>
                  </div>
                )}

                {withdrawal.payment_method === 'UPI' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">UPI ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-lg">{withdrawal.upi_id || 'Not available'}</span>
                      {withdrawal.upi_id && (
                        <button onClick={() => copyToClipboard(withdrawal.upi_id!, 'UPI ID')} className="text-indigo-600 hover:text-indigo-700">
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Transaction Details (if paid) */}
                {withdrawal.status === 'PAID' && withdrawal.transaction_id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-semibold text-green-700 mb-2">✅ Payment Completed</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Transaction ID:</span>
                        <span className="font-medium ml-2">{withdrawal.transaction_id}</span>
                      </div>
                      {withdrawal.payment_date && (
                        <div>
                          <span className="text-gray-600">Payment Date:</span>
                          <span className="font-medium ml-2">{formatDate(withdrawal.payment_date)}</span>
                        </div>
                      )}
                    </div>
                    {withdrawal.payment_details && (
                      <p className="text-xs text-gray-600 mt-2">{withdrawal.payment_details}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {withdrawal.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(withdrawal.id)}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Deduct from Wallet
                    </button>
                    <button
                      onClick={() => handleReject(withdrawal.id)}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}

                {withdrawal.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      setSelectedWithdrawal(withdrawal)
                      setShowPaidModal(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Mark as Paid (Enter Transaction ID)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showPaidModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">Mark as Paid</h3>
              <p className="text-sm text-gray-600 mt-1">
                Amount: {formatCurrency(selectedWithdrawal.net_payable)} to {selectedWithdrawal.affiliate_name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction ID / Reference Number *
                </label>
                <input
                  type="text"
                  value={transactionForm.transactionId}
                  onChange={(e) => setTransactionForm({ ...transactionForm, transactionId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter transaction ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={transactionForm.paymentDate}
                  onChange={(e) => setTransactionForm({ ...transactionForm, paymentDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Details (Optional)
                </label>
                <textarea
                  value={transactionForm.paymentDetails}
                  onChange={(e) => setTransactionForm({ ...transactionForm, paymentDetails: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional payment notes"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPaidModal(false)
                  setTransactionForm({ transactionId: "", paymentDate: new Date().toISOString().split('T')[0], paymentDetails: "" })
                }}
                className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={!transactionForm.transactionId || processing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
