"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import { DollarSign, AlertCircle } from "lucide-react"
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge"

type Transaction = {
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
  unlock_at: string | null
  credited_at: string | null
  has_return: boolean
  created_at: string
}

type EarningsResponse = {
  success: boolean
  stats: {
    totalEarned: number
    pendingEarnings: number
    totalTransactions: number
  }
  recentTransactions: Transaction[]
}

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

function EarningsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listFilter = searchParams.get("filter")
  const [user, setUser] = useState<{ first_name?: string; email?: string; refer_code?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

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
      setUser(JSON.parse(userData))
    } catch {
      router.push("/login")
    } finally {
      setAuthLoading(false)
    }
  }, [router])

  const earningsFetcher = (url: string, referCode: string) =>
    axios.get(url, { headers: { "x-affiliate-code": referCode } }).then((res) => res.data)

  const earningsUrl = useMemo(() => {
    if (!user?.refer_code) return null
    const base = "/api/affiliate/earnings"
    if (listFilter === "pending" || listFilter === "returns") {
      return `${base}?filter=${listFilter}`
    }
    return base
  }, [user?.refer_code, listFilter])

  const { data, isLoading } = useSWR<EarningsResponse>(
    user?.refer_code && earningsUrl ? [earningsUrl, user.refer_code] : null,
    ([url, referCode]: [string, string]) => earningsFetcher(url, referCode),
    { refreshInterval: 10000, revalidateOnFocus: true },
  )

  const stats = data?.success
    ? data.stats
    : { totalEarned: 0, pendingEarnings: 0, totalTransactions: 0 }

  const transactions = data?.success ? data.recentTransactions : []

  const filterLabel =
    listFilter === "returns"
      ? "Returns only"
      : listFilter === "pending"
        ? "Pending commission only"
        : null

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading commission...</div>
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
            <DollarSign className="w-6 h-6 text-amber-600" />
            My Commission
          </h2>
          <p className="text-gray-600 mt-1">Earnings from your referred customer orders</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Earned (Credited)</p>
            <p className="text-2xl font-bold text-emerald-600">₹{stats.totalEarned.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Pending Commission</p>
            <p className="text-2xl font-bold text-amber-600">₹{stats.pendingEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
          </div>
        </div>

        {filterLabel && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-900">
              Showing: <span className="font-semibold">{filterLabel}</span>
              {" "}({transactions.length} record{transactions.length === 1 ? "" : "s"})
            </p>
            <Link
              href="/dashboard/earnings"
              className="text-sm font-medium text-amber-800 hover:text-amber-950 underline shrink-0"
            >
              Clear filter
            </Link>
          </div>
        )}

        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Commission is calculated from orders placed by customers you referred. Pending amounts unlock after the return window.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Commission Ledger</h3>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/earnings?filter=pending"
                className={`text-xs font-medium px-2 py-1 rounded border ${listFilter === "pending" ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                Pending
              </Link>
              <Link
                href="/dashboard/earnings?filter=returns"
                className={`text-xs font-medium px-2 py-1 rounded border ${listFilter === "returns" ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                Returns
              </Link>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              {filterLabel
                ? `No transactions match this filter (${filterLabel.toLowerCase()}).`
                : "No commission recorded yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[180px] truncate">
                        {tx.product_name || "-"}
                        <p className="text-xs text-gray-400 mt-0.5">{tx.order_id}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.customer_name || "Customer"}
                        {tx.customer_email ? (
                          <p className="text-xs text-gray-400">{tx.customer_email}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{tx.order_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                        +₹{(tx.has_return ? 0 : tx.commission_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CommissionStatusBadge
                          status={tx.status}
                          unlockAt={tx.unlock_at}
                          hasReturn={tx.has_return}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function AffiliateEarningsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-lg text-gray-600">Loading commission...</div>
        </div>
      }
    >
      <EarningsContent />
    </Suspense>
  )
}
