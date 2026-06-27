"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import QRCode from 'qrcode'
import axios from 'axios'
import useSWR from 'swr'
import {
  Copy,
  Download,
  UserCircle2,
  Users,
  Wallet,
  TrendingUp,
  DollarSign,
  RotateCcw,
  ArrowUpRight,
  LogOut,
  LayoutDashboard,
  Package,
  Gift,
  User as UserIcon,
  Sparkles,
  CheckCircle2,
  QrCode,
  Info,
  Calendar,
  Mail,
  Phone,
  Hash,
} from 'lucide-react'
import { STORE_URL } from "@/lib/config"
import ConfirmModal from "@/app/components/ConfirmModal"
import CommissionStatusBadge from "@/app/components/CommissionStatusBadge"

interface AffiliateStats {
  referrals: {
    total: number
    active: number
    total_orders: number
    total_order_value: number
    total_returns: number
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
    unlock_at: string | null
    credited_at: string | null
    has_return: boolean
    has_return_request?: boolean
    created_at: string
  }>
}

type AdditionalCampaign = {
  id: number
  product_id: string
  product_name: string | null
  additional_rate: number
  target_role: string
  starts_at: string
  ends_at: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [affiliateRate, setAffiliateRate] = useState<number>(100) // Default 100% if not set
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })

  const generateBrandedQr = async (referCode: string, name: string, role: string) => {
    const signupUrl = `${STORE_URL}/signup?ref=${referCode}`
    const qrSize = 300
    const qrPadding = 20
    const canvasWidth = qrSize + qrPadding * 2
    const canvasHeight = qrSize + qrPadding * 2 + 68

    const canvas = document.createElement("canvas")
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    const qrCanvas = document.createElement("canvas")
    await QRCode.toCanvas(qrCanvas, signupUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#FFFFFF" },
    })

    const qrX = qrPadding
    const qrY = qrPadding
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    try {
      const logo = await loadImage("/oweg_O.png")
      const logoSize = 56
      const logoX = qrX + (qrSize - logoSize) / 2
      const logoY = qrY + (qrSize - logoSize) / 2

      // White circular backdrop so the logo stays scannable against the QR
      ctx.beginPath()
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 8, 0, Math.PI * 2)
      ctx.fillStyle = "#FFFFFF"
      ctx.fill()
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
    } catch (error) {
      console.error("Logo overlay failed:", error)
    }

    ctx.textAlign = "center"
    ctx.fillStyle = "#111827"
    ctx.font = "600 16px Arial"
    ctx.fillText(name || "Sales Executive", canvasWidth / 2, qrY + qrSize + 30)
    ctx.fillStyle = "#4B5563"
    ctx.font = "500 14px Arial"
    ctx.fillText(role || "Sales Executive", canvasWidth / 2, qrY + qrSize + 52)

    setQrDataUrl(canvas.toDataURL("image/png"))
  }

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

      // Generate branded QR code (logo + name/role) when user data is loaded
      if (parsedUser.refer_code) {
        const fullName =
          parsedUser.first_name && parsedUser.last_name
            ? `${parsedUser.first_name} ${parsedUser.last_name}`
            : parsedUser.email || "Sales Executive"
        generateBrandedQr(parsedUser.refer_code, fullName, "Sales Executive").catch(console.error)

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

  const { data: additionalData } = useSWR(
    "/api/additional-commissions/active?role=partner",
    fetcher,
    {
      refreshInterval: 10000,
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

  const performLogout = () => {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-100"></div>
            <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  // Personalized greeting based on local time (cosmetic only).
  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'
  const fullName = user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email
  const initials = (user?.first_name?.[0] || '') + (user?.last_name?.[0] || '') || (user?.email?.[0] || 'U')
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Use wallet balance from SWR data or default to 0
  const walletBalance = walletData?.success ? walletData.data.balance.current : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      {/* ─── Top Navigation ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/75 border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand + Primary Nav */}
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-200">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">Sales Executive</span>
                  <span className="text-[10px] text-slate-400">Partner Console</span>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl">
                <NavTab href="/dashboard" icon={LayoutDashboard} label="Dashboard" active />
                <NavTab href="/products" icon={Package} label="Products" />
                <NavTab href="/offers" icon={Gift} label="Offers" />
                <NavTab href="/dashboard/profile" icon={UserIcon} label="Profile" />
              </div>
            </div>

            {/* Live + User + Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-medium text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Updates
              </div>

              <div className="hidden sm:flex items-center gap-2.5 pl-3 pr-1 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                <div className="text-right leading-tight">
                  <p className="text-[11px] text-slate-400">Welcome</p>
                  <p className="text-xs font-semibold text-slate-900 max-w-[140px] truncate">{fullName}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold uppercase">
                  {initials}
                </div>
              </div>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* ─── Hero / Greeting ───────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 sm:p-10 text-white shadow-xl shadow-emerald-200/40">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,.35) 0, transparent 35%), radial-gradient(circle at 80% 20%, rgba(255,255,255,.25) 0, transparent 40%)'
            }} />
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-10 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />

            <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-emerald-100/90 text-sm mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>{today}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  {greeting}, {user?.first_name || 'Partner'} 👋
                </h1>
                <p className="text-emerald-50/90 mt-2 text-base">
                  Here's a snapshot of your performance and earnings.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/products"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold text-sm shadow-md transition-all hover:scale-[1.02]"
                >
                  <Package className="w-4 h-4" />
                  Browse Products
                </a>
                <a
                  href="/dashboard/wallet"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 rounded-xl font-semibold text-sm transition-all"
                >
                  <Wallet className="w-4 h-4" />
                  Wallet
                </a>
              </div>
            </div>
          </section>

          {/* ─── Stats Grid ────────────────────────────────────────── */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Total Referrals"
              value={String(stats?.referrals.total || 0)}
              meta={`${stats?.referrals.active || 0} active customers`}
              icon={Users}
              gradient="from-blue-500 to-indigo-500"
              accent="text-blue-600"
              ringClass="ring-blue-100"
              href="/dashboard/referrals"
            />
            <StatCard
              label="Total Orders"
              value={String(stats?.referrals.total_orders || 0)}
              meta={`₹${(stats?.referrals.total_order_value || 0).toLocaleString('en-IN')} order value`}
              icon={TrendingUp}
              gradient="from-violet-500 to-purple-500"
              accent="text-violet-600"
              ringClass="ring-violet-100"
              href="/dashboard/orders"
            />
            <StatCard
              label="Total Returns"
              value={String(stats?.referrals.total_returns || 0)}
              meta="Cancelled + return requests"
              icon={RotateCcw}
              gradient="from-rose-500 to-red-500"
              accent="text-rose-600"
              ringClass="ring-rose-100"
              href="/dashboard/returns"
            />
            <StatCard
              label="Total Commission"
              value={`₹${(stats?.commission.total_earned || 0).toFixed(2)}`}
              meta={`₹${(stats?.commission.pending || 0).toFixed(2)} pending`}
              metaTone="amber"
              icon={DollarSign}
              gradient="from-amber-500 to-orange-500"
              accent="text-amber-600"
              ringClass="ring-amber-100"
              href="/dashboard/earnings"
            />

            {/* Wallet Card — featured */}
            <a href="/dashboard/wallet" className="group block">
              <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/50 transition-all hover:-translate-y-0.5">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] uppercase tracking-wider text-emerald-100 font-semibold">Wallet Balance</p>
                  <p className="text-3xl font-bold text-white mt-1 tracking-tight">₹{walletBalance.toFixed(2)}</p>
                  {(stats?.wallet.locked || 0) > 0 ? (
                    <p className="text-xs text-emerald-100/90 mt-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      ₹{((stats?.wallet.locked || 0) * affiliateRate / 100).toFixed(2)} unlocking soon
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-100/80 mt-2">All funds available</p>
                  )}
                </div>
              </div>
            </a>
          </section>

          {/* ─── Active Additional Commission Banner ──────────────── */}
          <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Active Additional Commission</h3>
                    <p className="text-[11px] text-slate-500">Bonus boosts on selected products</p>
                  </div>
                </div>
                <a href="/offers" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  View Offers <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              {!additionalData?.campaigns?.length ? (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Info className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No additional commission campaign is active for you right now.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(additionalData.campaigns as AdditionalCampaign[]).slice(0, 3).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 hover:shadow-md hover:border-emerald-200 transition-all"
                    >
                      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-emerald-200/40 group-hover:bg-emerald-200/60 transition-colors" />
                      <div className="relative">
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{campaign.product_name || campaign.product_id}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ends {campaign.ends_at ? new Date(campaign.ends_at).toLocaleString("en-IN") : "Not set"}
                        </p>
                        <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-full shadow-sm">
                          <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">+{Number(campaign.additional_rate || 0).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ─── Partner Code + QR + How It Works ─────────────────── */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Partner Code */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Hash className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">Your Partner Code</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                </div>

                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-4 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold mb-1">Referral Code</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-extrabold text-slate-900 tracking-wide flex-1 truncate">{user?.refer_code}</span>
                    <button
                      onClick={copyReferralCode}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${copied
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 shadow-sm'
                        }`}
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Share this code with customers — they get registered under you and you earn commission on every purchase they make.
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                      <QrCode className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">Customer Registration</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-4">Scan or share to onboard customers</p>

                {qrDataUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-full max-w-[180px] h-auto rounded-lg"
                      />
                    </div>
                    <button
                      onClick={downloadQR}
                      className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download QR
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-[180px] h-[180px] rounded-xl bg-slate-100 animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 shadow-lg">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center">
                    <Info className="w-4 h-4 text-emerald-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">How It Works</h3>
                </div>

                <ol className="space-y-4">
                  <Step n={1} text="Share your QR code or referral link with customers" />
                  <Step n={2} text="Customer signs up using your unique code" />
                  <Step n={3} text="Earn commission on every purchase they make" />
                </ol>
              </div>
            </div>
          </section>

          {/* ─── Recent Activity ──────────────────────────────────── */}
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Recent Referrals */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-6 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Recent Referrals</h3>
                    <p className="text-[11px] text-slate-500">Latest customers you onboarded</p>
                  </div>
                </div>
                <a href="/dashboard/referrals" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  View all <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              <div className="px-6 pb-6">
                {stats?.recent_referrals && stats.recent_referrals.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recent_referrals.slice(0, 5).map((ref) => {
                      const refInitials = ((ref.customer_name || ref.customer_email || 'C').trim()[0] || 'C').toUpperCase()
                      return (
                        <div key={ref.id} className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {refInitials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{ref.customer_name || 'Customer'}</p>
                              <p className="text-xs text-slate-500 truncate">{ref.customer_email}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {ref.total_orders} {ref.total_orders === 1 ? 'order' : 'orders'}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">{formatDate(ref.referred_at)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No referrals yet</p>
                    <p className="text-xs text-slate-500 mt-1">Share your code to start earning</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Commission */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-6 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Recent Commission</h3>
                    <p className="text-[11px] text-slate-500">Earnings from your last referrals</p>
                  </div>
                </div>
                <a href="/dashboard/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  View all <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              <div className="px-6 pb-6">
                {stats?.recent_commissions && stats.recent_commissions.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recent_commissions.slice(0, 5).map((comm) => (
                      <div key={comm.id} className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{comm.product_name}</p>
                            <p className="text-xs text-slate-500">
                              ₹{comm.order_amount} <span className="text-slate-300">·</span> {comm.commission_rate}%
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{comm.order_id}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-base font-bold ${comm.has_return ? "text-slate-400 line-through" : "text-emerald-600"}`}>
                            +₹{(comm.has_return ? 0 : comm.commission_amount).toFixed(2)}
                          </p>
                          <div className="mt-1 flex justify-end">
                            <CommissionStatusBadge
                              status={comm.status}
                              unlockAt={comm.unlock_at}
                              hasReturn={comm.has_return}
                              returnRequestPending={comm.has_return_request && !comm.has_return}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <DollarSign className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No commission yet</p>
                    <p className="text-xs text-slate-500 mt-1">Earn when your referrals purchase</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ─── Your Information ─────────────────────────────────── */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <UserCircle2 className="w-4 h-4 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Your Information</h3>
                  <p className="text-[11px] text-slate-500">Account details on file</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoField
                  icon={UserIcon}
                  label="Name"
                  value={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : "N/A"}
                />
                <InfoField icon={Mail} label="Email" value={user?.email || "—"} />
                {user?.phone && <InfoField icon={Phone} label="Phone" value={user.phone} />}
                <InfoField icon={Hash} label="Referral Code" value={user?.refer_code || "—"} mono />
              </div>
            </div>
          </section>
        </div>
      </main>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Do you want to logout?"
        message="You will be returned to the login screen."
        confirmLabel="Yes, logout"
        cancelLabel="No"
        onConfirm={() => {
          setShowLogoutConfirm(false)
          performLogout()
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}

/* ─── UI Sub-components ──────────────────────────────────────────────
 * Pure presentational helpers. No business logic, no data access —
 * they only structure the redesigned dashboard chrome.
 * ────────────────────────────────────────────────────────────────── */

type LucideIcon = React.ComponentType<{ className?: string }>

function NavTab({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string
  icon: LucideIcon
  label: string
  active?: boolean
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${active
        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100'
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  )
}

function StatCard({
  label,
  value,
  meta,
  metaTone = 'muted',
  icon: Icon,
  gradient,
  accent,
  ringClass,
  href,
}: {
  label: string
  value: string
  meta: string
  metaTone?: 'muted' | 'amber'
  icon: LucideIcon
  gradient: string
  accent: string
  ringClass: string
  href?: string
}) {
  const card = (
    <div className={`group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm transition-all h-full ${href ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md hover:-translate-y-0.5'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm ring-4 ${ringClass}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className={`w-4 h-4 ${accent} ${href ? 'opacity-60 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
      <p className={`text-xs mt-2 ${metaTone === 'amber' ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>{meta}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    )
  }

  return card
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs font-bold flex-shrink-0 shadow-sm shadow-emerald-500/30">
        {n}
      </span>
      <span className="text-sm text-slate-200 leading-relaxed pt-1">{text}</span>
    </li>
  )
}

function InfoField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label}</p>
        <p className={`text-sm font-semibold text-slate-900 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

