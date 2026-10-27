"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { SmoothScroll } from "@/components/SmoothScroll"
import ConfirmModal from "@/app/components/ConfirmModal"
import { useTheme } from "@/contexts/ThemeContext"
import {
  LayoutDashboard,
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
  Banknote,
} from "lucide-react"


const navigationItems = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Store Management", href: "/admin/stores", icon: Store },
  { name: "Create State User", href: "/admin/create-state-user", icon: UserPlus },
  { name: "State Admins", href: "/admin/state-admins", icon: MapPin },
  { name: "Commission Settings", href: "/admin/commission-settings", icon: Percent },
  { name: "Set Commission", href: "/admin/set-commission", icon: Percent },
  { name: "Additional Commission", href: "/admin/additional-commission", icon: Percent },
  { name: "Commission overview", href: "/admin/product-commission", icon: Percent },
  //{ name: "Total Agent", href: "/admin/total-agent", icon: Users },
  { name: "TDS Settings", href: "/admin/tds-settings", icon: Settings },
  { name: "Payments", href: "/admin/payments", icon: Banknote },
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
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const loadAdminProfile = useCallback(async () => {
    const token = localStorage.getItem("affiliate_token")
    if (!token) return

    try {
      const response = await axios.get("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.data.success) {
        setUser(response.data.user)
        localStorage.setItem("affiliate_user", JSON.stringify(response.data.user))
      }
    } catch (error) {
      console.error("Failed to load admin profile:", error)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token")
    const userData = localStorage.getItem("affiliate_user")
    const role = localStorage.getItem("affiliate_role")

    if (!token || !userData) {
      router.replace("/login")
      return
    }

    if (role !== "admin") {
      router.replace("/dashboard")
      return
    }

    try {
      setUser(JSON.parse(userData))
      setAuthChecked(true)
      void loadAdminProfile()
    } catch (e) {
      console.error("Error parsing user data:", e)
      router.replace("/login")
    }
  }, [router, loadAdminProfile])

  const performLogout = () => {
    localStorage.removeItem("affiliate_token")
    localStorage.removeItem("affiliate_user")
    localStorage.removeItem("affiliate_role")
    router.push("/login")
  }

  const displayName = user?.name || user?.email || "National Head"
  const initial = displayName.charAt(0).toUpperCase()

  if (!authChecked) {
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
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`w-64 transition-transform duration-300 overflow-hidden flex flex-col fixed left-0 top-0 h-screen z-30 shadow-xl ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
          style={{ background: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)` }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottomColor: "rgba(255,255,255,0.2)", borderBottomWidth: "1px" }}
          >
            <div className="min-w-0">
              <div className="lg:hidden">
                <p className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Hello</p>
                <h1 className="text-base font-bold text-white tracking-wide truncate">
                  {displayName}
                </h1>
              </div>
              <h1 className="hidden lg:block text-xl font-bold text-white whitespace-nowrap">
                National Head
              </h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden shrink-0 text-white/70 hover:text-white"
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
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setSidebarOpen(false)
                    }
                  }}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  style={isActive ? { backgroundColor: "rgba(255,255,255,0.2)" } : {}}
                >
                  <Icon className="w-5 h-5 mr-3 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div
            className="p-4 relative"
            style={{ borderTopColor: "rgba(255,255,255,0.2)", borderTopWidth: "1px" }}
          >
            <div className="lg:hidden space-y-1">
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  router.push("/admin/profile")
                }}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <User className="w-5 h-5 mr-3 shrink-0" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  router.push("/admin/profile#theme")
                }}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Palette className="w-5 h-5 mr-3 shrink-0" />
                <span>Theme</span>
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  setShowLogoutConfirm(true)
                }}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors"
              >
                <LogOut className="w-5 h-5 mr-3 shrink-0" />
                <span>Logout</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-3 px-2 py-2 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.primaryHover})` }}
              >
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || user?.email}
                </p>
                <p className="text-xs text-white/60 truncate">
                  {user?.phone || user?.email}
                </p>
              </div>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
                title="More options"
              >
                <MoreVertical className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 hidden lg:block">
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push("/admin/profile")
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push("/admin/profile#theme")
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
                    setShowLogoutConfirm(true)
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
        <div className="flex-1 flex flex-col ml-0 lg:ml-64 transition-all duration-300 overflow-x-hidden min-w-0">
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden shrink-0 text-gray-500 hover:text-gray-700"
                  aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                >
                  <Menu className="w-6 h-6" />
                </button>
                <Link
                  href="/admin/dashboard"
                  className="lg:hidden text-sm font-semibold text-gray-900 truncate min-w-0 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded"
                >
                  NH
                </Link>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <button className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <span
                  className="hidden sm:inline-flex px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: theme.primaryLight, color: theme.primary }}
                >
                  National Head
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 scroll-smooth min-w-0">
            {children}
          </main>
        </div>
      </div>

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
    </>
  )
}
