"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  Users,
  UserCheck,
  DollarSign,
  Clock,
  ShoppingBag,
  MapPin,
  Building2,
  Percent,
  TrendingUp,
  ArrowUpRight,
  RotateCcw,
  LucideIcon,
} from "lucide-react"
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed"
import {
  mapActivityEventToFeedItem,
  type ActivityEvent,
} from "@/lib/recent-activity"

type CommissionRate = {
  role_type: string
  commission_percentage: number
}

type DashboardCard = {
  label: string
  value: number
  href: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  borderColor: string
  hoverBorderColor: string
  linkText?: string
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalAgents: 0,
    pendingRequests: 0,
    totalCommission: 0,
    pendingPayout: 0,
    totalOrders: 0,
    totalReturns: 0,
  })
  const [adminStats, setAdminStats] = useState({
    stateAdmins: 0,
    areaManagers: 0,
    branchAdmins: 0,
  })
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch affiliate stats
      const statsResponse = await axios.get("/api/affiliate/admin/stats")
      const statsData = statsResponse.data
      if (statsData.success && statsData.stats) {
        setStats({
          totalAgents: statsData.stats.totalAgents || 0,
          pendingRequests: statsData.stats.pendingRequests || 0,
          totalCommission: statsData.stats.totalCommission || 0,
          pendingPayout: statsData.stats.pendingPayout || 0,
          totalOrders: statsData.stats.totalOrders || 0,
          totalReturns: statsData.stats.totalReturns || 0,
        })
      }

      // Fetch admin stats
      const adminStatsResponse = await axios.get("/api/admin/stats")
      const adminStatsData = adminStatsResponse.data
      if (adminStatsData.success) {
        setAdminStats(adminStatsData.stats)
      }

      // Fetch commission rates
      const ratesResponse = await axios.get("/api/admin/commission-rates")
      const ratesData = ratesResponse.data
      if (ratesData.success) {
        setCommissionRates(ratesData.rates)
      }

      // Fetch recent activity  
      const activityResponse = await axios.get("/api/affiliate/admin/activity?limit=5")
      const activityData = activityResponse.data
      if (activityData.success) {
        setActivities(activityData.activities || [])
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const activityFeedItems = useMemo(
    () => activities.map(mapActivityEventToFeedItem),
    [activities],
  )

  const getRoleLabel = (roleType: string) => {
    switch (roleType) {
      case "state":
        return "State Admin"
      case "area":
        return "Branch Admin"
      case "branch":
        return "Area sales Manager"
      case "branch_direct":
        return "Area sales Manager Direct Bonus"
      case "affiliate":
        return "Sales Executive"
      default:
        return roleType
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const dashboardCards: DashboardCard[] = [
    {
      label: "State Admins",
      value: adminStats.stateAdmins,
      href: "/admin/total-agent?tab=state_admins",
      icon: MapPin,
      iconBg: "bg-indigo-100 group-hover:bg-indigo-200",
      iconColor: "text-indigo-600",
      borderColor: "border-indigo-100",
      hoverBorderColor: "hover:border-indigo-300",
    },
    {
      label: "Branch Managers",
      value: adminStats.areaManagers,
      href: "/admin/total-agent?tab=area_managers",
      icon: Users,
      iconBg: "bg-emerald-100 group-hover:bg-emerald-200",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-100",
      hoverBorderColor: "hover:border-emerald-300",
    },
    {
      label: "Area sales Managers",
      value: adminStats.branchAdmins,
      href: "/admin/total-agent?tab=branch_admins",
      icon: Building2,
      iconBg: "bg-blue-100 group-hover:bg-blue-200",
      iconColor: "text-blue-600",
      borderColor: "border-blue-100",
      hoverBorderColor: "hover:border-blue-300",
    },
    {
      label: "Total Sales Executive",
      value: stats.totalAgents,
      href: "/admin/total-agent",
      icon: Users,
      iconBg: "bg-sky-100 group-hover:bg-sky-200",
      iconColor: "text-sky-600",
      borderColor: "border-sky-100",
      hoverBorderColor: "hover:border-sky-300",
    },
    {
      label: "Sales Executive Requests",
      value: stats.pendingRequests,
      href: "/admin/affiliate-request",
      icon: UserCheck,
      iconBg: "bg-orange-100 group-hover:bg-orange-200",
      iconColor: "text-orange-600",
      borderColor: "border-orange-100",
      hoverBorderColor: "hover:border-orange-300",
      linkText: "Review pending",
    },
    {
      label: "Total Orders",
      value: stats.totalOrders,
      href: "/admin/order-layout",
      icon: ShoppingBag,
      iconBg: "bg-purple-100 group-hover:bg-purple-200",
      iconColor: "text-purple-600",
      borderColor: "border-purple-100",
      hoverBorderColor: "hover:border-purple-300",
      linkText: "All transactions",
    },
    {
      label: "Total returns",
      value: stats.totalReturns,
      href: "/admin/returns",
      icon: RotateCcw,
      iconBg: "bg-rose-100 group-hover:bg-rose-200",
      iconColor: "text-rose-600",
      borderColor: "border-rose-100",
      hoverBorderColor: "hover:border-rose-300",
      linkText: "View all",
    },
  ]

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your Partner program</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Side - Stats (3 columns on large screens) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dashboardCards.map((card) => {
              const Icon = card.icon
              return (
                <a
                  key={card.label}
                  href={card.href}
                  className={`group bg-white p-6 rounded-xl border-2 ${card.borderColor} ${card.hoverBorderColor} transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-3 ${card.iconBg} rounded-xl transition-colors`}>
                      <Icon className={`w-8 h-8 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 text-center mt-1">{card.value}</p>
                  <div className="mt-2 flex items-center justify-center text-xs text-gray-500">
                    <span>{card.linkText ?? "View all"}</span>
                    <ArrowUpRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </a>
              )
            })}
          </div>

          <RecentActivityFeed
            items={activityFeedItems}
            loading={false}
            viewAllHref="/admin/activity"
          />
        </div>

        {/* Right Side - Sidebar Widgets */}
        <div className="xl:col-span-1 space-y-6">
          {/* Commission Rates - Sticky on Desktop */}
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl shadow-sm border border-indigo-200 p-6 xl:sticky xl:top-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Percent className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Commission Rates</h2>
            </div>
            <div className="space-y-4">
              {commissionRates.filter(rate => rate.role_type !== 'branch_direct').map((rate) => (
                <div key={rate.role_type} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">{getRoleLabel(rate.role_type)}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-2xl font-bold text-indigo-600">{rate.commission_percentage}</p>
                      <span className="text-sm text-indigo-600 font-medium">%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/admin/commission-settings"
              className="mt-5 flex items-center justify-center w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
            >
              Manage Rates
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </a>
          </div>

          {/* Quick Links - Enhanced */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <a
                href="/admin/total-commission"
                className="group flex items-center justify-between p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors border border-green-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-700 font-medium">Total Commission</p>
                    <p className="text-sm font-bold text-green-900">{formatCurrency(stats.totalCommission)}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>

              <a
                href="/admin/pending-payout"
                className="group flex items-center justify-between p-4 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 font-medium">Pending Payout</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrency(stats.pendingPayout)}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
