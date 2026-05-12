"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import { Download, Users } from "lucide-react"

interface ReferralItem {
  id: string
  customer_email: string
  customer_name: string
  referred_at: string
  total_orders: number
  total_commission: number
}

interface ReferralsResponse {
  success: boolean
  total: number
  referrals: ReferralItem[]
}

export default function AllReferralsPage() {
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

  const referralsFetcher = (url: string, referCode: string) => axios.get(url, {
    headers: { "x-affiliate-code": referCode }
  }).then(res => res.data)

  const { data, isLoading } = useSWR<ReferralsResponse>(
    user?.refer_code ? ["/api/affiliate/referrals", user.refer_code] : null,
    ([url, referCode]: [string, string]) => referralsFetcher(url, referCode),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true
    }
  )

  const referrals = useMemo(() => data?.referrals || [], [data])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  const exportReferralsToExcel = () => {
    if (!referrals.length) return

    const headers = ["Customer", "Email", "Referred On", "Orders", "Commission (INR)"]
    const rows = referrals.map((item) => [
      item.customer_name || "Customer",
      item.customer_email || "",
      formatDate(item.referred_at),
      String(item.total_orders ?? 0),
      item.total_commission?.toFixed(2) ?? "0.00"
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const today = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `referrals-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading referrals...</div>
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
              <a href="/dashboard/profile" className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md text-sm font-medium transition-colors">
                Profile
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
              <Users className="w-6 h-6 text-blue-600" />
              All Referrals
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{data?.total || 0} total</span>
              <button
                onClick={exportReferralsToExcel}
                disabled={!referrals.length}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>

          {referrals.length === 0 ? (
            <p className="text-sm text-gray-500">No referrals found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Referred On</th>
                    <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase text-right">Orders</th>
                    <th className="py-3 px-2 text-xs font-semibold text-gray-500 uppercase text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-2 text-sm font-medium text-gray-900">{item.customer_name || "Customer"}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{item.customer_email}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{formatDate(item.referred_at)}</td>
                      <td className="py-3 px-2 text-sm text-gray-700 text-right">{item.total_orders}</td>
                      <td className="py-3 px-2 text-sm font-semibold text-emerald-600 text-right">₹{item.total_commission.toFixed(2)}</td>
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
