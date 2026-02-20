"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { SmoothScroll } from "@/components/SmoothScroll"
import { useTheme } from "@/contexts/ThemeContext"
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  Percent,
  Settings,
  UserPlus,
  MapPin,
  Store,
  MoreVertical,
  User,
  Palette,
  Bell,
  Banknote
} from "lucide-react"


const navigationItems = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "State Admins", href: "/admin/state-admins", icon: MapPin },
  { name: "Create State User", href: "/admin/create-state-user", icon: UserPlus },
  { name: "Store Management", href: "/admin/stores", icon: Store },
  { name: "Commission Settings", href: "/admin/commission-settings", icon: Percent },
  { name: "Payments", href: "/admin/payments", icon: Banknote },
  { name: "Set Commission", href: "/admin/set-commission", icon: Percent },
  { name: "Product Commission", href: "/admin/product-commission", icon: Percent },
  { name: "Total Agent", href: "/admin/total-agent", icon: Users },
  { name: "TDS Settings", href: "/admin/tds-settings", icon: Settings },
  { name: "Commission Ledger", href: "/admin/ledger", icon: Banknote },
]





export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token")
    const userData = localStorage.getItem("affiliate_user")
    const role = localStorage.getItem("affiliate_role")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    if (role !== "admin") {
      router.push("/dashboard")
      return
    }

    try {
      setUser(JSON.parse(userData))
    } catch (e) {
      console.error("Error parsing user data:", e)
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("affiliate_token")
    localStorage.removeItem("affiliate_user")
    localStorage.removeItem("affiliate_role")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <SmoothScroll />
      <div className="min-h-screen flex overflow-x-hidden" style={{ backgroundColor: theme.background }}>
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? "w-64" : "w-0"
            } transition-all duration-300 overflow-hidden flex flex-col fixed h-screen z-30`}
          style={{ background: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)` }}
        >
          <div className="flex items-center justify-between p-4" style={{ borderBottomColor: 'rgba(255,255,255,0.2)', borderBottomWidth: '1px' }}>
            <h1 className="text-xl font-bold text-white whitespace-nowrap">
              Partner&apos;s admin
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  style={isActive ? { backgroundColor: 'rgba(255,255,255,0.2)' } : {}}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 relative" style={{ borderTopColor: 'rgba(255,255,255,0.2)', borderTopWidth: '1px' }}>
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              {/* Circular Profile Icon */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.primaryHover})` }}>
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || user?.email}
                </p>
                <p className="text-xs text-white/60 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
                title="More options"
              >
                <MoreVertical className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    // Navigate to profile page
                    router.push('/admin/profile')
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/admin/profile#theme')
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Palette className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Theme</span>
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-64" : "ml-0"} transition-all duration-300 overflow-x-hidden`}>
          {/* Top Bar */}
          <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-4 ml-auto">
                <button className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
                  Admin
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}

