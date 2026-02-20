"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import QRCode from 'qrcode'
import axios from 'axios'
import useSWR from 'swr'
import { Copy, Download, UserCircle2, Users, Wallet, TrendingUp, DollarSign, Check, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { STORE_URL } from "@/lib/config"
import UserNavbar from "../components/UserNavbar"

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

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  refer_code: string;
  phone?: string;
  state?: string;
  role: string;
  is_agent?: boolean;
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [affiliateRate, setAffiliateRate] = useState<number>(100) // Default 100% if not set

  // Mobile-only UI state
  const [showHowItWorks, setShowHowItWorks] = useState(false)

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
          (r: { role_type: string }) => r.role_type === "affiliate"
        )
        if (affiliateRateObj) {
          setAffiliateRate(parseFloat(affiliateRateObj.commission_percentage))
        }
      }
    } catch (err) {
      console.error("Error fetching affiliate rate:", err)
    }
  }


  const copyReferralCode = async () => {
    if (user?.refer_code) {
      await navigator.clipboard.writeText(user.refer_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadQR = () => {
    if (qrDataUrl && user) {
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
        {/* Desktop loading */}
        <div className="hidden md:block text-lg text-gray-600">Loading...</div>

        {/* Mobile loading skeleton */}
        <div className="md:hidden w-full px-4 pt-20 space-y-4">
          <div className="h-8 bg-gray-200 rounded-xl animate-pulse w-48" />
          <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-32" />
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // Use wallet balance from SWR data or default to 0
  const walletBalance = walletData?.success ? walletData.data.balance.current : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <UserNavbar userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Dashboard Header */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Partner Dashboard
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Welcome back, {user?.first_name} {user?.last_name}
            </p>
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* Stats Cards Grid                                            */}
          {/* Desktop: 4 columns | Mobile: 2×2 grid                      */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {/* Total Referrals */}
            <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 active:scale-95 transition-transform md:active:scale-100">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">Total Referrals</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.referrals.total || 0}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{stats?.referrals.active || 0} active customers</p>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 active:scale-95 transition-transform md:active:scale-100">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">Total Orders</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.referrals.total_orders || 0}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">₹{(stats?.referrals.total_order_value || 0).toLocaleString('en-IN')} value</p>
            </div>

            {/* Total Commission */}
            <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 active:scale-95 transition-transform md:active:scale-100">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">Commission</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">₹{(stats?.commission.total_earned || 0).toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">₹{(stats?.commission.pending || 0).toFixed(2)} pending</p>
            </div>

            {/* Wallet Balance — full-width on mobile */}
            <a href="/dashboard/wallet" className="block col-span-2 md:col-span-1">
              <div className="wallet-card bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full relative overflow-hidden">
                {/* Shimmer layer — mobile only visual enhancement */}
                <div className="absolute inset-0 md:hidden wallet-shimmer pointer-events-none rounded-xl" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-emerald-100">Wallet Balance</p>
                    <p className="text-2xl font-bold text-white">₹{walletBalance.toFixed(2)}</p>
                  </div>
                  {/* Arrow hint on mobile */}
                  <div className="md:hidden ml-auto">
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                {(stats?.wallet.locked || 0) > 0 && (
                  <p className="relative text-xs text-emerald-200 mt-2">₹{((stats?.wallet.locked || 0) * affiliateRate / 100).toFixed(2)} unlocking soon</p>
                )}
                <p className="relative md:hidden text-xs text-white/60 mt-1">Tap to view wallet →</p>
              </div>
            </a>
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* Cards Grid                                                  */}
          {/* Desktop: 3 columns | Mobile: 1 column stacked              */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-3">
            {/* Your Partner Code Card */}
            <div className="bg-emerald-50/50 rounded-2xl p-5 md:p-6 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-4">
                <UserCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Your Partner Code</h3>
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500 text-white">
                  Active
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 mb-3">
                <span className="font-mono text-sm md:text-base font-bold text-gray-900 flex-1 truncate">{user?.refer_code}</span>
                <button
                  onClick={copyReferralCode}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all active:scale-90 flex-shrink-0 ${copied
                    ? 'bg-emerald-500 text-white border border-emerald-500'
                    : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}>
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-600">Share this code with customers to earn commissions</p>
            </div>

            {/* Customer Registration QR Code */}
            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Customer Registration</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">For customer sign-ups</p>

              {/* QR content — always visible */}
              {qrDataUrl && (
                <div className="flex flex-col items-center">
                  <div className="relative w-full max-w-[180px] aspect-square mx-auto">
                    <Image
                      src={qrDataUrl}
                      alt="QR Code"
                      fill
                      className="rounded-lg object-contain"
                      unoptimized
                    />
                  </div>
                  <button
                    onClick={downloadQR}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium w-full justify-center active:scale-95">
                    <Download className="w-3.5 h-3.5" />
                    Download QR
                  </button>
                </div>
              )}
            </div>

            {/* How it Works */}
            <div className="bg-blue-50/50 rounded-2xl p-5 md:p-6 shadow-sm border border-blue-100">
              {/* Mobile: Collapsible How It Works toggle */}
              <button
                className="md:hidden w-full flex items-center justify-between mb-0"
                onClick={() => setShowHowItWorks(!showHowItWorks)}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-gray-900 text-sm">How It Works</span>
                </div>
                {showHowItWorks ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
              </button>

              {/* Desktop: always visible header */}
              <div className="hidden md:flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-semibold text-gray-900 text-sm">How It Works</h3>
              </div>

              {/* Steps — always on desktop, toggle on mobile */}
              <div className={`mt-3 md:mt-0 ${showHowItWorks ? 'block' : 'hidden md:block'}`}>
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
          </div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* Recent Activity Grid                                        */}
          {/* Desktop: 2 columns | Mobile: 1 column                      */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2">
            {/* Recent Referrals */}
            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200">
              <h3 className="text-base font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Recent Referrals
              </h3>
              {stats?.recent_referrals && stats.recent_referrals.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.recent_referrals.slice(0, 5).map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between p-2.5 md:p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar initial */}
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 font-bold text-xs">
                            {(ref.customer_name || ref.customer_email || 'C')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ref.customer_name || 'Customer'}</p>
                          {/* Email hidden on mobile to avoid overflow */}
                          <p className="text-xs text-gray-500 hidden md:block truncate">{ref.customer_email}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
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
            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200">
              <h3 className="text-base font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Recent Commission
              </h3>
              {stats?.recent_commissions && stats.recent_commissions.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.recent_commissions.slice(0, 5).map((comm) => (
                    <div key={comm.id} className="flex items-center justify-between p-2.5 md:p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[160px] md:max-w-none">{comm.product_name}</p>
                        <p className="text-xs text-gray-500">₹{comm.order_amount} @ {comm.commission_rate}%</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
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
          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200">
            <h3 className="text-base font-semibold mb-4 text-gray-900">Your Information</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-sm font-medium text-gray-900">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
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
