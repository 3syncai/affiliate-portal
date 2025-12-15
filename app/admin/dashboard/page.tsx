"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  Users,
  UserCheck,
  DollarSign,
  Clock,
  TrendingUp,
  ShoppingBag,
  UserPlus,
  CheckCircle,
  XCircle
} from "lucide-react"

type Activity = {
  id: string
  type: 'affiliate_request' | 'order' | 'approval'
  timestamp: string
  data: any
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
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch stats
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
        return <UserPlus className="w-5 h-5 text-orange-600" />
      case 'approval':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'order':
        return <ShoppingBag className="w-5 h-5 text-purple-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
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

  const statCards = [
    {
      title: "Total Agent",
      value: stats.totalAgents,
      icon: Users,
      color: "bg-blue-500",
      href: "/admin/total-agent",
    },
    {
      title: "Affiliate Request",
      value: stats.pendingRequests,
      icon: UserCheck,
      color: "bg-orange-500",
      href: "/admin/affiliate-request",
    },
    {
      title: "Total Commission",
      value: `₹${stats.totalCommission.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-green-500",
      href: "/admin/total-commission",
    },
    {
      title: "Pending Payout",
      value: `₹${stats.pendingPayout.toLocaleString()}`,
      icon: Clock,
      color: "bg-yellow-500",
      href: "/admin/pending-payout",
    },
    {
      title: "Order Layout",
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: "bg-purple-500",
      href: "/admin/order-layout",
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your affiliate program</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <a
              key={card.title}
              href={card.href}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </a>
          )
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No recent activity to display</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    {getActivityText(activity)}
                  </div>
                  {activity.type === 'order' && (
                    <div className="mt-1 text-xs text-gray-500">
                      Order #{activity.data.order_id} • {activity.data.product_name}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-gray-500">
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
