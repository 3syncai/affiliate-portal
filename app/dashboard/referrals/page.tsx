"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import { Download, Users } from "lucide-react"
import UserNavbar from "@/app/components/UserNavbar"

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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <UserNavbar userName={user?.first_name || user?.email || undefined} />

      <main className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <Users className="w-6 h-6 text-blue-600 shrink-0" />
              All Referrals
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">{data?.total || 0} total</span>
              <button
                onClick={exportReferralsToExcel}
                disabled={!referrals.length}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto justify-center"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>

          {referrals.length === 0 ? (
            <p className="text-sm text-gray-500">No referrals found yet.</p>
          ) : (
            <>
            <div className="md:hidden space-y-3">
              {referrals.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{item.customer_name || "Customer"}</p>
                  <p className="text-sm text-gray-600 break-all">{item.customer_email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                    <span>Referred {formatDate(item.referred_at)}</span>
                    <span>{item.total_orders} orders</span>
                    <span className="font-semibold text-emerald-700">₹{Number(item.total_commission || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[560px]">
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
            </>
          )}
        </div>
      </main>
    </div>
  )
}
