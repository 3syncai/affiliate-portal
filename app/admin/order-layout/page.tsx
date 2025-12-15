"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Package, DollarSign, TrendingUp, Eye, Download, Filter, Calendar } from "lucide-react"

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
  const [orders, setOrders] = useState<AffiliateOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<AffiliateOrder | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [dateFilter, setDateFilter] = useState<string>("ALL")

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
      "PENDING": "bg-yellow-100 text-yellow-800",
      "APPROVED": "bg-green-100 text-green-800",
      "PAID": "bg-blue-100 text-blue-800",
      "REJECTED": "bg-red-100 text-red-800"
    }
    return statusColors[status] || "bg-gray-100 text-gray-800"
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
        <div className="text-lg text-gray-500">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order Layout</h1>
          <p className="text-gray-600 mt-1">View and manage affiliate orders</p>
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
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{totalOrders}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalOrderAmount)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Commission</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalCommission)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Commission</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{avgCommissionRate.toFixed(1)}%</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent col-span-2"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">Last 30 Days</option>
          </select>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredOrders.length}</span> of <span className="font-semibold text-gray-900">{orders.length}</span> orders
          </p>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>{searchTerm || statusFilter !== "ALL" || dateFilter !== "ALL" ? "No orders found matching your filters" : "No orders available"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Affiliate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-indigo-600">
                        {order.order_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{order.affiliate_name}</div>
                      <div className="text-xs text-gray-500">{order.affiliate_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={order.product_name}>
                        {order.product_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {order.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                      {formatCurrency(order.order_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="font-semibold text-green-600">{formatCurrency(order.commission_amount)}</div>
                      <div className="text-xs text-gray-500">{order.commission_rate}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedOrder(order)}
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

      {/* View Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Order Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Order ID</p>
                    <p className="text-sm font-medium text-indigo-600">{selectedOrder.order_id}</p>
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
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Product Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Product Name</span>
                    <span className="text-sm font-medium text-gray-900">{selectedOrder.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity</span>
                    <span className="text-sm font-medium text-gray-900">{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Item Price</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedOrder.item_price)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">Order Amount</span>
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(selectedOrder.order_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Affiliate Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Affiliate Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <div>
                    <p className="text-xs text-indigo-700 mb-1">Affiliate Name</p>
                    <p className="text-sm font-medium text-indigo-900">{selectedOrder.affiliate_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-700 mb-1">Affiliate Code</p>
                    <p className="text-sm font-medium text-indigo-900">{selectedOrder.affiliate_code}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-indigo-700 mb-1">Email</p>
                    <p className="text-sm font-medium text-indigo-900">{selectedOrder.affiliate_email || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Commission Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Commission Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold uppercase mb-2">Commission Rate</p>
                    <p className="text-2xl font-bold text-green-600">{selectedOrder.commission_rate}%</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold uppercase mb-2">Commission Amount</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedOrder.commission_amount)}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold uppercase mb-2">Source</p>
                    <p className="text-lg font-bold text-green-600 capitalize">{selectedOrder.commission_source}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
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

