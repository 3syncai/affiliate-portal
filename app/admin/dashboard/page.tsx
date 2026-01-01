"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  Users,
  UserCheck,
  DollarSign,
  Clock,
  ShoppingBag,
  UserPlus,
  CheckCircle,
  MapPin,
  Building2,
  Percent,
  TrendingUp,
  ArrowUpRight
} from "lucide-react"

type Activity = {
  id: string
  type: 'affiliate_request' | 'order' | 'approval'
  timestamp: string
  data: any
}

type CommissionRate = {
  role_type: string
  commission_percentage: number
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalAgents: 0,
    pendingRequests: 0,
    totalCommission: 0,
    pendingPayout: 0,
    totalOrders: 0,
  })
  const [adminStats, setAdminStats] = useState({
    stateAdmins: 0,
    areaManagers: 0,
    branchAdmins: 0,
  })
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
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
      const activityResponse = await axios.get("/api/affiliate/admin/activity")
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'affiliate_request':
        return { icon: UserPlus, bg: 'bg-orange-100', text: 'text-orange-600' }
      case 'approval':
        return { icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-600' }
      case 'order':
        return { icon: ShoppingBag, bg: 'bg-purple-100', text: 'text-purple-600' }
      default:
        return { icon: Clock, bg: 'bg-gray-100', text: 'text-gray-600' }
    }
  }

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'affiliate_request':
        return (
          <div>
            <span className="font-semibold text-gray-900">{activity.data.name}</span>
            <span className="text-gray-600"> submitted an affiliate request</span>
          </div>
        )
      case 'approval':
        return (
          <div>
            <span className="font-semibold text-gray-900">{activity.data.name}</span>
            <span className="text-green-600"> was approved as an affiliate</span>
          </div>
        )
      case 'order':
        return (
          <div>
            <span className="font-semibold text-gray-900">{activity.data.affiliate_name}</span>
            <span className="text-gray-600"> earned </span>
            <span className="font-semibold text-green-600">{formatCurrency(activity.data.commission_amount)}</span>
            <span className="text-gray-600"> commission</span>
          </div>
        )
      default:
        return <span className="text-gray-600">Unknown activity</span>
    }
  }

  const getRoleLabel = (roleType: string) => {
    switch (roleType) {
      case "state":
        return "State Admin"
      case "area":
        return "Area Manager"
      case "branch":
        return "Branch Admin"
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

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your affiliate program</p>
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
          {/* Affiliate Stats - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="/admin/total-agent"
              className="group bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-200 p-6 transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Agents</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalAgents}</p>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span>View all</span>
                    <ArrowUpRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
              </div>
            </a>

            <a
              href="/admin/affiliate-request"
              className="group bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-200 p-6 transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">Affiliate Requests</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingRequests}</p>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span>Review pending</span>
                    <ArrowUpRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg">
                  <UserCheck className="w-7 h-7 text-white" />
                </div>
              </div>
            </a>

            <a
              href="/admin/order-layout"
              className="group bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-200 p-6 transition-all duration-200 hover:-translate-y-1 sm:col-span-2 lg:col-span-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span>All transactions</span>
                    <ArrowUpRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg">
                  <ShoppingBag className="w-7 h-7 text-white" />
                </div>
              </div>
            </a>
          </div>

          {/* Admin Counts - Enhanced Design */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Admin Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="group bg-white p-6 rounded-xl border-2 border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                    <MapPin className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 text-center">{adminStats.stateAdmins}</p>
                <p className="text-sm text-gray-600 text-center mt-2">State Admins</p>
              </div>

              <div className="group bg-white p-6 rounded-xl border-2 border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                    <Users className="w-8 h-8 text-emerald-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 text-center">{adminStats.areaManagers}</p>
                <p className="text-sm text-gray-600 text-center mt-2">Area Managers</p>
              </div>

              <div className="group bg-white p-6 rounded-xl border-2 border-blue-100 hover:border-blue-300 transition-all cursor-pointer">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 text-center">{adminStats.branchAdmins}</p>
                <p className="text-sm text-gray-600 text-center mt-2">Branch Admins</p>
              </div>
            </div>
          </div>

          {/* Recent Activity - Enhanced */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              <p className="text-sm text-gray-600 mt-1">Latest updates from your platform</p>
            </div>
            <div className="p-6">
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No recent activity to display</p>
                  <p className="text-sm text-gray-400 mt-1">Activity will appear here as it happens</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activities.slice(0, 6).map((activity) => {
                    const activityData = getActivityIcon(activity.type)
                    const IconComponent = activityData.icon
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className={`flex-shrink-0 p-2 ${activityData.bg} rounded-lg`}>
                          <IconComponent className={`w-5 h-5 ${activityData.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm leading-relaxed">
                            {getActivityText(activity)}
                          </div>
                          {activity.type === 'order' && (
                            <div className="mt-1 text-xs text-gray-500">
                              Order #{activity.data.order_id} • {activity.data.product_name}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTimeAgo(activity.timestamp)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
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
              {commissionRates.map((rate) => (
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
