"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Package, DollarSign, TrendingUp, Eye, Download, Filter, Calendar, Search, Copy, ChevronDown } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

type AffiliateOrder = {
  id: string
  order_id: string
  affiliate_code: string
  affiliate_name: string
  affiliate_email: string
  product_name: string
  quantity: number
  item_price: number
  order_amount: number
  commission_rate: number
  commission_amount: number
  commission_source: string
  status: string
  created_at: string
  customer_id: string
}

export default function OrderLayoutPage() {
  const { theme } = useTheme()
  const [orders, setOrders] = useState<AffiliateOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<AffiliateOrder | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [dateFilter, setDateFilter] = useState<string>("ALL")
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showDateMenu, setShowDateMenu] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const response = await axios.get("/api/affiliate/admin/orders")
      setOrders(response.data.orders || [])
    } catch (error) {
      console.error("Failed to fetch orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      "PENDING": "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",
      "APPROVED": "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100",
      "PAID": "bg-blue-50 text-blue-700 border-blue-200 ring-blue-100",
      "REJECTED": "bg-red-50 text-red-700 border-red-200 ring-red-100"
    }
    return statusColors[status] || "bg-gray-50 text-gray-700 border-gray-200 ring-gray-100"
  }

  const exportToCSV = () => {
    const headers = [
      "Order ID", "Date", "Affiliate Name", "Affiliate Code",
      "Product", "Quantity", "Item Price", "Order Amount",
      "Commission Rate", "Commission Amount", "Status"
    ]
    const rows = filteredOrders.map(o => [
      o.order_id,
      formatDate(o.created_at),
      o.affiliate_name,
      o.affiliate_code,
      o.product_name,
      o.quantity,
      o.item_price,
      o.order_amount,
      `${o.commission_rate}%`,
      o.commission_amount,
      o.status
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `affiliate-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => { })
  }

  const statusLabel = statusFilter === "ALL" ? "All Status" : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()
  const dateLabel = dateFilter === "ALL"
    ? "All Time"
    : dateFilter === "TODAY"
      ? "Today"
      : dateFilter === "WEEK"
        ? "Last 7 Days"
        : "Last 30 Days"

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      order.order_id.toLowerCase().includes(searchLower) ||
      order.affiliate_name.toLowerCase().includes(searchLower) ||
      order.affiliate_code.toLowerCase().includes(searchLower) ||
      order.product_name.toLowerCase().includes(searchLower)

    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter

    let matchesDate = true
    if (dateFilter !== "ALL") {
      const orderDate = new Date(order.created_at)
      const now = new Date()

      if (dateFilter === "TODAY") {
        matchesDate = orderDate.toDateString() === now.toDateString()
      } else if (dateFilter === "WEEK") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        matchesDate = orderDate >= weekAgo
      } else if (dateFilter === "MONTH") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        matchesDate = orderDate >= monthAgo
      }
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  // Calculate statistics
  const totalOrders = filteredOrders.length
  const totalOrderAmount = filteredOrders.reduce((sum, o) => sum + o.order_amount, 0)
  const totalCommission = filteredOrders.reduce((sum, o) => sum + o.commission_amount, 0)
  const avgCommissionRate = filteredOrders.length > 0
    ? filteredOrders.reduce((sum, o) => sum + o.commission_rate, 0) / filteredOrders.length
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-current rounded-full animate-spin" style={{ color: theme.primary }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 bg-gray-50/50 -m-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Order Layout</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage partner orders</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm font-semibold text-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{totalOrders}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.primary}15` }}>
              <Package className="w-6 h-6" style={{ color: theme.primary }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{formatCurrency(totalOrderAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Commission</p>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums">{formatCurrency(totalCommission)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Avg Commission</p>
              <p className="text-3xl font-bold text-orange-600">{avgCommissionRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Search with icon */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="md:hidden grid grid-cols-2 gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowStatusMenu((prev) => !prev)
                  setShowDateMenu(false)
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-xs font-semibold text-gray-700 flex items-center justify-between"
              >
                <span>{statusLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showStatusMenu ? "rotate-180" : "rotate-0"}`} />
              </button>
              {showStatusMenu && (
                <>
                  <button
                    type="button"
                    aria-label="Close status menu"
                    onClick={() => setShowStatusMenu(false)}
                    className="fixed inset-0 z-10 bg-transparent"
                  />
                  <div className="absolute left-0 top-full mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
                    {["ALL", "PENDING", "APPROVED", "PAID", "REJECTED"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setStatusFilter(value)
                          setShowStatusMenu(false)
                        }}
                        className={`w-full px-3 py-2.5 text-left text-xs font-semibold transition-colors ${statusFilter === value ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {value === "ALL" ? "All Status" : value.charAt(0) + value.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDateMenu((prev) => !prev)
                  setShowStatusMenu(false)
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-xs font-semibold text-gray-700 flex items-center justify-between"
              >
                <span>{dateLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDateMenu ? "rotate-180" : "rotate-0"}`} />
              </button>
              {showDateMenu && (
                <>
                  <button
                    type="button"
                    aria-label="Close date menu"
                    onClick={() => setShowDateMenu(false)}
                    className="fixed inset-0 z-10 bg-transparent"
                  />
                  <div className="absolute left-0 top-full mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
                    {[
                      { value: "ALL", label: "All Time" },
                      { value: "TODAY", label: "Today" },
                      { value: "WEEK", label: "Last 7 Days" },
                      { value: "MONTH", label: "Last 30 Days" }
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setDateFilter(item.value)
                          setShowDateMenu(false)
                        }}
                        className={`w-full px-3 py-2.5 text-left text-xs font-semibold transition-colors ${dateFilter === item.value ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hidden md:block px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="hidden md:block px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm bg-white"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">Last 30 Days</option>
          </select>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold text-gray-900">{filteredOrders.length}</span> of <span className="font-bold text-gray-900">{orders.length}</span> orders
          </p>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">{searchTerm || statusFilter !== "ALL" || dateFilter !== "ALL" ? "No orders found matching your filters" : "No orders available"}</p>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <>
            <div className="md:hidden overflow-x-auto -mx-4 px-4">
              <table className="min-w-[760px] w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-medium" style={{ color: theme.primary }} title={order.order_id}>
                            {order.order_id.length > 14 ? `${order.order_id.slice(0, 8)}...${order.order_id.slice(-4)}` : order.order_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(order.order_id)}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                            title="Copy Order ID"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                        {formatDate(order.created_at).split(",")[0]}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-gray-900">{order.affiliate_name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{order.affiliate_code}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-gray-900 max-w-[160px] truncate" title={order.product_name}>
                          {order.product_name}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-right text-gray-900 font-semibold tabular-nums">
                        {order.quantity}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-right font-bold text-blue-600 tabular-nums">
                        {formatCurrency(order.order_amount)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-right">
                        <div className="font-bold text-emerald-600 tabular-nums">{formatCurrency(order.commission_amount)}</div>
                        <div className="text-[10px] text-gray-500 tabular-nums">{order.commission_rate}%</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded-md border ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hidden md:block overflow-x-auto -mx-6 px-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Order Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium" style={{ color: theme.primary }}>
                          {order.order_id}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{order.affiliate_name}</div>
                        <div className="text-xs text-gray-500 font-mono">{order.affiliate_code}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={order.product_name}>
                          {order.product_name}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold tabular-nums">
                        {order.quantity}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600 tabular-nums">
                        {formatCurrency(order.order_amount)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                        <div className="font-bold text-emerald-600 tabular-nums">{formatCurrency(order.commission_amount)}</div>
                        <div className="text-xs text-gray-500 tabular-nums">{order.commission_rate}%</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-semibold transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* View Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Information */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Order Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Order ID</p>
                    <p className="text-sm font-mono font-semibold" style={{ color: theme.primary }}>{selectedOrder.order_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Order Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Customer ID</p>
                    <p className="text-sm font-medium text-gray-900">{selectedOrder.customer_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Information */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Product Details</h3>
                <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Product Name</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedOrder.product_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Quantity</span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Item Price</span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(selectedOrder.item_price)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-gray-700">Order Amount</span>
                    <span className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(selectedOrder.order_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Affiliate Information */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Affiliate Information</h3>
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-gray-200 bg-white">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Affiliate Name</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedOrder.affiliate_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Affiliate Code</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{selectedOrder.affiliate_code}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-900">{selectedOrder.affiliate_email || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Commission Information */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Commission Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 font-bold uppercase mb-2">Commission Rate</p>
                    <p className="text-2xl font-bold text-emerald-600">{selectedOrder.commission_rate}%</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 font-bold uppercase mb-2">Commission Amount</p>
                    <p className="text-2xl font-bold text-emerald-600 tabular-nums">{formatCurrency(selectedOrder.commission_amount)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 font-bold uppercase mb-2">Source</p>
                    <p className="text-lg font-bold text-emerald-600 capitalize">{selectedOrder.commission_source}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors shadow-sm"
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

