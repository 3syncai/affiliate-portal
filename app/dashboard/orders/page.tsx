"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import { DollarSign } from "lucide-react"

interface OrderItem {
  id: string
  order_id: string
  product_name: string
  customer_name: string
  customer_email: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  commission_source: string
  status: string
  created_at: string
}

interface OrdersResponse {
  success: boolean
  total: number
  orders: OrderItem[]
}

export default function AllOrdersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch {
      router.push("/login")
      return
    } finally {
      setLoading(false)
    }
  }, [router])

  const ordersFetcher = (url: string, referCode: string) => axios.get(url, {
    headers: { "x-affiliate-code": referCode }
  }).then(res => res.data)

  const { data, isLoading } = useSWR<OrdersResponse>(
    user?.refer_code ? ["/api/affiliate/orders", user.refer_code] : null,
    ([url, referCode]: [string, string]) => ordersFetcher(url, referCode),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true
    }
  )

  const orders = useMemo(() => data?.orders || [], [data])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, <strong className="text-gray-900">{user?.first_name || user?.email}</strong></span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-600" />
              All Orders
            </h2>
            <span className="text-sm text-gray-500">{data?.total || 0} total</span>
          </div>

          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders found yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.product_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{order.order_id}</p>
                      <p className="text-xs text-gray-500 mt-1">{order.customer_name || "Customer"} {order.customer_email ? `(${order.customer_email})` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">+₹{order.commission_amount.toFixed(2)}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${order.status === "CREDITED" ? "bg-green-100 text-green-700" : order.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <span>Amount: ₹{order.order_amount.toFixed(2)}</span>
                    <span>Rate: {order.commission_rate}%</span>
                    <span>Date: {formatDate(order.created_at)}</span>
                    <span className="uppercase">Source: {order.commission_source || "affiliate"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
