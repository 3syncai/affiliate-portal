"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import NotificationDropdown from "@/components/NotificationDropdown"
import { useTheme } from "@/contexts/ThemeContext"
import {
    LayoutDashboard,
    Users,
    LogOut,
    Menu,
    X,
    Building,
    MapPin,
    UserCheck,
    Package,
    DollarSign,
    Clock,
    ShoppingBag,
    MoreVertical,
    User,
    Palette,
    TrendingUp,
    Bell,
    Share2
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/branch/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/branch/products", icon: Package },
    { name: "Affiliate Request", href: "/branch/affiliate-request", icon: UserCheck },
    { name: "Agents in Branch", href: "/branch/agents", icon: Users },
    { name: "My Referrals", href: "/branch/my-referrals", icon: Share2 },
    { name: "My Earnings", href: "/branch/earnings", icon: TrendingUp },
    { name: "Pending Payout", href: "/branch/pending-payout", icon: Clock },
    { name: "Order Layout", href: "/branch/order-layout", icon: ShoppingBag },
]




export default function BranchLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const token = localStorage.getItem("affiliate_token")
        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")

        if (!token || !userData) {
            router.push("/login")
            return
        }

        if (role !== "branch") {
            router.push("/dashboard")
            return
        }

        try {
            const parsed = JSON.parse(userData)
            setUser(parsed)

            // Fetch notifications
            if (parsed.id) {
                fetch(`/api/notifications?recipientId=${parsed.id}&recipientRole=branch`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setUnreadCount(data.unreadCount || 0)
                        }
                    })
                    .catch(err => console.error("Failed to fetch notifications:", err))
            }
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
        <div className="min-h-screen flex overflow-x-hidden" style={{ backgroundColor: theme.background }}>
            <aside
                className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden flex flex-col fixed h-screen z-30 shadow-xl`}
                style={{ backgroundColor: theme.sidebar }}
            >
                <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                            <Building className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">Branch Portal</h1>
                            <p className="text-xs text-white/60 font-medium tracking-wide uppercase">Workspace</p>
                        </div>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">Menu</div>
                    {navigationItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-white/70 hover:bg-white/10 hover:text-white hover:pl-5"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? "text-gray-900" : "text-white/70 group-hover:text-white"}`} />
                                <span>{item.name}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current" style={{ color: theme.primary }} />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 m-4 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-3">
                        {/* Circular Profile Icon */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-white/20 to-white/10 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-white/10">
                            {(user?.first_name || 'B').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-white/50 truncate">{user?.branch}</p>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {showUserMenu && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 transform origin-bottom-right animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-3 py-2 border-b border-gray-50 mb-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false)
                                            router.push('/branch/profile')
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <User className="w-4 h-4 mr-3 text-gray-400" />
                                        <span>Profile</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false)
                                            router.push('/branch/profile#theme')
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Palette className="w-4 h-4 mr-3 text-gray-400" />
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
                    </div>
                </div>
            </aside>

            <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-72" : "ml-0"} transition-all duration-300 overflow-x-hidden min-w-0`}>
                <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 transition-all duration-200">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <h2 className="text-lg font-semibold text-gray-900 lg:hidden">
                                {navigationItems.find(i => i.href === pathname)?.name || 'Dashboard'}
                            </h2>
                        </div>

                        <div className="flex items-center space-x-3 ml-auto">
                            {/* Notification Bell */}
                            {user?.id && (
                                <NotificationDropdown userId={user.id} userRole="branch" />
                            )}
                            <div className="h-8 w-px bg-gray-200 mx-2"></div>
                            <div
                                className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 border border-transparent transition-all hover:shadow-sm"
                                style={{
                                    backgroundColor: `${theme.primary}10`,
                                    color: theme.primary,
                                    borderColor: `${theme.primary}20`
                                }}
                            >
                                <div className="p-0.5 rounded-full bg-current">
                                    <Building className="w-3 h-3 text-white" />
                                </div>
                                <span className="pr-1">{user?.branch || "Branch Admin"}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 scroll-smooth">
                    {children}
                </main>
            </div>
        </div>
    )
}
