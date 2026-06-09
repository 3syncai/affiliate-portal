"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { RotateCcw, Search, XCircle, Package } from "lucide-react"
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge"
import type { IssueType } from "@/lib/returns-response"

type ReturnOrder = {
  order_id: string
  product_name: string
  customer_name: string | null
  customer_email: string | null
  order_amount: number
  commission_status: string
  has_return: boolean
  return_status: string | null
  return_requested_at: string | null
  issue_type: IssueType
  created_at: string
}

type ReturnStats = {
  total: number
  cancelled: number
  returnRequested: number
}

type FilterKey = "all" | "cancelled" | "return_requested"

function SalesExecutiveNav({ userName }: { userName: string }) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Sales Executive</h1>
            <a href="/dashboard" className="ml-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors">
              Dashboard
            </a>
            <a href="/products" className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors">
              Products
            </a>
            <a href="/offers" className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors">
              Offers
            </a>
            <a href="/dashboard/profile" className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors">
              Profile
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, <strong className="text-gray-900">{userName}</strong></span>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function AffiliateReturnsPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<ReturnOrder[]>([])
  const [stats, setStats] = useState<ReturnStats>({
    total: 0,
    cancelled: 0,
    returnRequested: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [user, setUser] = useState<{ first_name?: string; email?: string; refer_code?: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token")
    const userData = localStorage.getItem("affiliate_user")
    const role = localStorage.getItem("affiliate_role")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    if (role === "admin") {
      router.push("/admin/dashboard")
      return
    }

    try {
      const parsed = JSON.parse(userData)
      setUser(parsed)
      if (parsed.refer_code) {
        fetchReturns(parsed.refer_code)
      }
    } catch {
      router.push("/login")
    }
  }, [router])

  const fetchReturns = async (referCode: string) => {
    setLoading(true)
    try {
      const response = await axios.get("/api/affiliate/returns", {
        headers: { "x-affiliate-code": referCode },
      })
      if (response.data.success) {
        setOrders(response.data.orders || [])
        setStats(
          response.data.stats || { total: 0, cancelled: 0, returnRequested: 0 },
        )
      }
    } catch (error) {
      console.error("Failed to fetch returns:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "cancelled" &&
          (order.issue_type === "cancelled" || order.issue_type === "both")) ||
        (activeFilter === "return_requested" &&
          (order.issue_type === "return_requested" || order.issue_type === "both"))

      if (!matchesFilter) return false

      const q = searchTerm.toLowerCase()
      return (
        order.order_id.toLowerCase().includes(q) ||
        (order.product_name || "").toLowerCase().includes(q) ||
        (order.customer_name || "").toLowerCase().includes(q) ||
        (order.customer_email || "").toLowerCase().includes(q)
      )
    })
  }, [orders, activeFilter, searchTerm])

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const formatCurrency = (amount: number) =>
    `₹${(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const issueLabel = (type: IssueType) => {
    if (type === "both") return "Cancelled + Return"
    if (type === "cancelled") return "Cancelled"
    return "Return Requested"
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading returns...</div>
      </div>
    )
  }

  const userName = user?.first_name || user?.email || "Partner"

  return (
    <div className="min-h-screen bg-gray-50">
      <SalesExecutiveNav userName={userName} />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-600" />
            Total Returns
          </h2>
          <p className="text-gray-600 mt-1">
            Cancelled and return-requested orders from your referred customers
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Returns</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Cancelled Orders</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Return Requested</p>
            <p className="text-2xl font-bold text-rose-600">{stats.returnRequested}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order id, product, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "All" },
                { key: "cancelled", label: "Cancelled" },
                { key: "return_requested", label: "Return Requested" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveFilter(chip.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === chip.key
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No returns found for this filter.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        #{String(order.order_id).slice(-8)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                        <span className="inline-flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {order.product_name || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.customer_name || order.customer_email || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                            order.issue_type === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : order.issue_type === "return_requested"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {order.issue_type === "cancelled" && <XCircle className="w-3 h-3" />}
                          {order.issue_type === "return_requested" && <RotateCcw className="w-3 h-3" />}
                          {issueLabel(order.issue_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {order.return_status
                          ? order.return_status.replace(/_/g, " ")
                          : order.has_return
                            ? "Requested"
                            : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CommissionStatusBadge
                          status={order.commission_status}
                          hasReturn={order.has_return}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(order.order_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
