"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Clock, Check, X, Copy, CreditCard, Calendar, FileText, AlertCircle } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

type Withdrawal = {
  id: number
  affiliate_name: string
  affiliate_email: string
  affiliate_code: string
  affiliate_branch?: string
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
  const { theme } = useTheme()
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
      fetchWithdrawals()
    }
  }, [filter, branchData])

  const fetchWithdrawals = async () => {
    if (!branchData?.branch) return
    setLoading(true)
    try {
      const url = filter === "ALL"
        ? `/api/branch/withdrawals?branch=${encodeURIComponent(branchData.branch)}`
        : `/api/branch/withdrawals?branch=${encodeURIComponent(branchData.branch)}&status=${filter}`

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
  }


  const handleApprove = async (withdrawalId: number) => {
    if (!confirm('Are you sure you want to approve this withdrawal request?\n\nThis will deduct the amount from affiliate\'s wallet.')) {
      return
    }

    setProcessing(true)
    try {
      await axios.post('/api/branch/withdrawals', {
        withdrawalId,
        action: 'APPROVE',
        adminNotes: 'Approved by branch admin'
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
      await axios.post('/api/branch/withdrawals', {
        withdrawalId,
        action: 'REJECT',
        adminNotes: reason || 'Rejected by branch admin'
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
      await axios.post('/api/branch/withdrawals/mark-paid', {
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
    // Optional: could replace with a toast notification for better UX
    // alert(`${label} copied to clipboard!`) 
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
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
      APPROVED: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100',
      REJECTED: 'bg-red-50 text-red-700 border-red-200 ring-red-100',
      PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100'
    }
    return styles[status as keyof typeof styles] || 'bg-gray-50 text-gray-700 border-gray-200 ring-gray-100'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Withdrawal Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and process partner withdrawal requests</p>
      </div>

      {/* Filter Tabs - Modern Pills */}
      <div className="flex gap-2 p-1 bg-gray-100/80 rounded-xl w-fit">
        {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((tab) => {
          const isActive = filter === tab
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${isActive
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
            >
              {tab === 'ALL' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          )
        })}
      </div>

      {/* Withdrawals List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-current rounded-full animate-spin" style={{ color: theme.primary }}></div>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">No requests found</h3>
          <p className="text-xs text-gray-500 mt-1">Withdrawal requests will appear here based on your filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => (
            <div key={withdrawal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
              {/* Card Header */}
              <div className="p-6 border-b border-gray-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-gray-900">{withdrawal.affiliate_name}</h3>
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{withdrawal.affiliate_code}</span>
                  </div>
                  <p className="text-sm text-gray-500">{withdrawal.affiliate_email}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getStatusBadge(withdrawal.status)}`}>
                  {withdrawal.status}
                </span>
              </div>

              <div className="p-6">
                {/* Financial Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 rounded-lg bg-gray-50/50 border border-gray-100 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Amount</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(withdrawal.withdrawal_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">GST ({withdrawal.gst_percentage}%)</p>
                    <p className="text-lg font-semibold text-red-500">-{formatCurrency(withdrawal.gst_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Payable</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(withdrawal.net_payable)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Requested</p>
                    <div className="flex items-center text-sm font-medium text-gray-700 mt-1">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                      {formatDate(withdrawal.requested_at)}
                    </div>
                  </div>
                </div>

                {/* Grid Layout for Details & Actions */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Payment Details Column */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      Payment Method: {withdrawal.payment_method}
                    </h4>

                    <div className="bg-white border border-gray-100 rounded-lg p-3 space-y-2 text-sm">
                      {withdrawal.payment_method === 'Bank Transfer' && (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">Account Name</span>
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              {withdrawal.account_name}
                              <button onClick={() => copyToClipboard(withdrawal.account_name!, 'Name')} className="text-gray-400 hover:text-indigo-600">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">Account No</span>
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              {withdrawal.account_number}
                              <button onClick={() => copyToClipboard(withdrawal.account_number!, 'Account Number')} className="text-gray-400 hover:text-indigo-600">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">IFSC Code</span>
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              {withdrawal.ifsc_code}
                              <button onClick={() => copyToClipboard(withdrawal.ifsc_code!, 'IFSC')} className="text-gray-400 hover:text-indigo-600">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">Bank Name</span>
                            <span className="font-medium text-gray-900">{withdrawal.bank_name}</span>
                          </div>
                        </>
                      )}
                      {withdrawal.payment_method === 'UPI' && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-500">UPI ID</span>
                          <div className="flex items-center gap-2 font-bold text-gray-900">
                            {withdrawal.upi_id}
                            <button onClick={() => copyToClipboard(withdrawal.upi_id!, 'UPI ID')} className="text-gray-400 hover:text-indigo-600">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions / Status Info Column */}
                  <div className="flex flex-col justify-end">
                    {withdrawal.status === 'PENDING' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(withdrawal.id)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:shadow disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(withdrawal.id)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}

                    {withdrawal.status === 'APPROVED' && (
                      <div>
                        <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded-md mb-3 flex items-start gap-2 border border-amber-100">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <p>Funds have been deducted. Please process the transfer manually and then mark as paid.</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal)
                            setShowPaidModal(true)
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:shadow"
                        >
                          <CreditCard className="w-4 h-4" />
                          Mark as Paid
                        </button>
                      </div>
                    )}

                    {withdrawal.status === 'PAID' && withdrawal.transaction_id && (
                      <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Payment Completed
                        </p>
                        <div className="text-xs text-emerald-900/70 space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span>TXN ID:</span>
                            <span>{withdrawal.transaction_id}</span>
                          </div>
                          {withdrawal.payment_date && (
                            <div className="flex justify-between">
                              <span>DATE:</span>
                              <span>{formatDate(withdrawal.payment_date).split(',')[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {withdrawal.status === 'REJECTED' && (
                      <div className="bg-red-50/50 rounded-lg p-3 border border-red-100">
                        <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5" /> Request Rejected
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showPaidModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">Confirm Payment</h3>
              <p className="text-sm text-gray-500 mt-1">
                Enter transaction details for the transfer of <span className="font-bold text-gray-900">{formatCurrency(selectedWithdrawal.net_payable)}</span>
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Transaction ID / UTR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionForm.transactionId}
                  onChange={(e) => setTransactionForm({ ...transactionForm, transactionId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. UTR123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={transactionForm.paymentDate}
                  onChange={(e) => setTransactionForm({ ...transactionForm, paymentDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={transactionForm.paymentDetails}
                  onChange={(e) => setTransactionForm({ ...transactionForm, paymentDetails: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-y min-h-[80px]"
                  placeholder="Any internal notes about this transfer..."
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
              <button
                onClick={() => {
                  setShowPaidModal(false)
                  setTransactionForm({ transactionId: "", paymentDate: new Date().toISOString().split('T')[0], paymentDetails: "" })
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={!transactionForm.transactionId || processing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                {processing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
