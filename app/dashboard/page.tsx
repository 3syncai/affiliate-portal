"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import QRCode from 'qrcode'
import axios from 'axios'
import useSWR from 'swr'
import { Copy, Download, UserCircle2, Users, Wallet, TrendingUp, DollarSign } from 'lucide-react'
import { STORE_URL } from "@/lib/config"

interface AffiliateStats {
  referrals: {
    total: number
    active: number
    total_orders: number
    total_order_value: number
  }
  commission: {
    total_earned: number
    pending: number
    credited: number
  }
  wallet: {
    balance: number
    locked: number
  }
  recent_referrals: Array<{
    id: string
    customer_email: string
    customer_name: string
    referred_at: string
    first_order_at: string | null
    total_orders: number
    total_commission: number
  }>
  recent_commissions: Array<{
    id: string
    order_id: string
    product_name: string
    order_amount: number
    commission_rate: number
    commission_amount: number
    commission_source: string
    status: string
    created_at: string
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [affiliateRate, setAffiliateRate] = useState<number>(100) // Default 100% if not set
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("affiliate_token")
    const userData = localStorage.getItem("affiliate_user")
    const role = localStorage.getItem("affiliate_role")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    // If admin, redirect to admin dashboard
    if (role === "admin") {
      router.push("/admin/dashboard")
      return
    }

    try {
      const parsedUser = JSON.parse(userData)

      // Check if user is approved
      if (!parsedUser.is_approved) {
        router.push("/verification-pending")
        return
      }

      // If rejected, redirect to pending page (which will show rejection)
      if (parsedUser.rejected_at) {
        router.push("/verification-pending")
        return
      }

      setUser(parsedUser)

      // Generate QR code when user data is loaded
      if (parsedUser.refer_code) {
        const signupUrl = `${STORE_URL}/signup?ref=${parsedUser.refer_code}`
        QRCode.toDataURL(signupUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }).then(setQrDataUrl).catch(console.error)

        fetchAffiliateRate()
      }
    } catch (e) {
      console.error("Error parsing user data:", e)
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }, [router])

  // SWR Fetcher
  const fetcher = (url: string) => axios.get(url).then(res => res.data)
  const statsFetcher = (url: string, referCode: string) => axios.get(url, {
    headers: { 'x-affiliate-code': referCode }
  }).then(res => res.data)

  // Use SWR for real-time updates (polls every 5 seconds)
  const { data: stats } = useSWR<AffiliateStats>(
    user?.refer_code ? ['/api/affiliate/stats', user.refer_code] : null,
    ([url, referCode]: [string, string]) => statsFetcher(url, referCode),
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true
    }
  )

  const { data: walletData } = useSWR(
    user?.refer_code ? `/api/affiliate/wallet?refer_code=${user.refer_code}` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true
    }
  )

  const fetchAffiliateRate = async () => {
    try {
      const response = await axios.get("/api/admin/commission-rates")
      if (response.data.success && response.data.rates) {
        const affiliateRateObj = response.data.rates.find(
          (r: any) => r.role_type === "affiliate"
        )
        if (affiliateRateObj) {
          setAffiliateRate(parseFloat(affiliateRateObj.commission_percentage))
        }
      }
    } catch (err) {
      console.error("Error fetching affiliate rate:", err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("affiliate_token")
    localStorage.removeItem("affiliate_user")
    localStorage.removeItem("affiliate_role")
    router.push("/login")
  }

  const copyReferralCode = async () => {
    if (user?.refer_code) {
      await navigator.clipboard.writeText(user.refer_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadQR = () => {
    if (qrDataUrl) {
      const link = document.createElement('a')
      link.download = `referral-qr-${user.refer_code}.png`
      link.href = qrDataUrl
      link.click()
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  // Use wallet balance from SWR data or default to 0
  const walletBalance = walletData?.success ? walletData.data.balance.current : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">

              <h1 className="text-xl font-semibold text-gray-900">Partner Portal</h1>
              <span className="ml-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </span>
              <a
                href="/products"
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 rounded-md text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Products
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Live Updates | Welcome, <strong className="text-gray-900">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Agent Dashboard Header */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Partner Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.first_name} {user?.last_name}</p>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Total Referrals */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Referrals</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.referrals.total || 0}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{stats?.referrals.active || 0} active customers</p>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.referrals.total_orders || 0}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">₹{(stats?.referrals.total_order_value || 0).toLocaleString('en-IN')} value</p>
            </div>

            {/* Total Commission */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Commission</p>
                  <p className="text-2xl font-bold text-gray-900">₹{(stats?.commission.total_earned || 0).toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">₹{(stats?.commission.pending || 0).toFixed(2)} pending</p>
            </div>

            {/* Wallet Balance */}
            <a href="/dashboard/wallet" className="block">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">Wallet Balance</p>
                    <p className="text-2xl font-bold text-white">₹{walletBalance.toFixed(2)}</p>
                  </div>
                </div>
                {(stats?.wallet.locked || 0) > 0 && (
                  <p className="text-xs text-emerald-200 mt-2">₹{((stats?.wallet.locked || 0) * affiliateRate / 100).toFixed(2)} unlocking soon</p>
                )}
              </div>
            </a>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Your Agent Code Card */}
            <div className="bg-emerald-50/50 rounded-2xl p-6 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-4">
                <UserCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Your Partner Code</h3>
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500 text-white">
                  Active
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 mb-3">
                <span className="font-mono text-base font-bold text-gray-900 flex-1">{user?.refer_code}</span>
                <button
                  onClick={copyReferralCode}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-600">Share this code with customers to earn commissions</p>
            </div>

            {/* Customer Registration QR Code */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Customer Registration</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">For customer sign-ups</p>
              {qrDataUrl && (
                <div className="flex flex-col items-center">
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-full max-w-[180px] h-auto rounded-lg"
                  />
                  <button
                    onClick={downloadQR}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium w-full justify-center">
                    <Download className="w-3.5 h-3.5" />
                    Download QR
                  </button>
                </div>
              )}
            </div>

            {/* How it Works */}
            <div className="bg-blue-50/50 rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-semibold text-gray-900 text-sm">How It Works</h3>
              </div>
              <ol className="space-y-2.5 text-xs text-gray-700">
                <li className="flex gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-xs font-semibold flex-shrink-0">1</span>
                  <span>Share your QR code or referral link</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-xs font-semibold flex-shrink-0">2</span>
                  <span>Customer signs up with your code</span>
                </li>
                <li className="flex gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-xs font-semibold flex-shrink-0">3</span>
                  <span>Earn commission when they purchase!</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Recent Activity Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Referrals */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-base font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Recent Referrals
              </h3>
              {stats?.recent_referrals && stats.recent_referrals.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_referrals.slice(0, 5).map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ref.customer_name || 'Customer'}</p>
                        <p className="text-xs text-gray-500">{ref.customer_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{formatDate(ref.referred_at)}</p>
                        <p className="text-xs font-medium text-emerald-600">{ref.total_orders} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No referrals yet</p>
                  <p className="text-xs">Share your code to start earning!</p>
                </div>
              )}
            </div>

            {/* Recent Commission */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-base font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Recent Commission
              </h3>
              {stats?.recent_commissions && stats.recent_commissions.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_commissions.slice(0, 5).map((comm) => (
                    <div key={comm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{comm.product_name}</p>
                        <p className="text-xs text-gray-500">₹{comm.order_amount} @ {comm.commission_rate}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">+₹{comm.commission_amount.toFixed(2)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${comm.status === 'CREDITED' ? 'bg-green-100 text-green-700' :
                          comm.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {comm.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No commission yet</p>
                  <p className="text-xs">Earn when referrals purchase!</p>
                </div>
              )}
            </div>
          </div>

          {/* Your Information */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-base font-semibold mb-4 text-gray-900">Your Information</h3>
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-sm font-medium text-gray-900">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              </div>
              {user?.phone && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{user.phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="text-sm font-medium text-gray-900">{user?.is_agent ? "Partner" : "User"}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
