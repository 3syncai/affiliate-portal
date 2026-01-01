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
    Bell
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/branch/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/branch/products", icon: Package },
    { name: "Affiliate Request", href: "/branch/affiliate-request", icon: UserCheck },
    { name: "Agents in Branch", href: "/branch/agents", icon: Users },
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
            <aside className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 overflow-hidden flex flex-col fixed h-screen z-30`} style={{ background: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)` }}>
                <div className="flex items-center justify-between p-4" style={{ borderBottomColor: 'rgba(255,255,255,0.2)', borderBottomWidth: '1px' }}>
                    <h1 className="text-xl font-bold text-white whitespace-nowrap flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Branch Admin
                    </h1>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
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
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                            >
                                <Icon className="w-5 h-5 mr-3" />
                                <span>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 relative" style={{ borderTopWidth: '1px', borderTopColor: 'rgba(255,255,255,0.2)' }}>
                    <div className="flex items-center gap-3 px-4 py-2 mb-2">
                        {/* Circular Profile Icon */}
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {(user?.first_name || 'B').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-orange-200 truncate">{user?.branch}</p>
                        </div>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="ml-2 p-1 hover:bg-orange-700 rounded transition-colors text-orange-100"
                            title="More options"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    // Navigate to profile page (if exists) or just alert
                                    // Based on context, specific profile pages might exist or not. 
                                    // Admin has /admin/profile. Branch likely doesn't have one explicitly requested yet?
                                    // User said "create the 3 dot and use profile and theme".
                                    // I'll stick to a generic alert or route if unsure.
                                    // Let's route to /branch/profile just in case, or show the same UI.
                                    // Actually, let's leave it as a placeholder or consistent with admin.
                                    // Admin: router.push('/admin/profile')
                                    // I'll use /branch/profile. I might need to create it later if it fails.
                                    router.push('/branch/profile')
                                }}
                                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <User className="w-4 h-4 mr-3 text-gray-500" />
                                <span>Profile</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    router.push('/branch/profile#theme')
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

            <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-64" : "ml-0"} transition-all duration-300 overflow-x-hidden`}>
                <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500 hover:text-gray-700">
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center space-x-4 ml-auto">
                            {/* Notification Bell */}
                            {user?.id && (
                                <NotificationDropdown userId={user.id} userRole="branch" />
                            )}
                            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
                                <Building className="w-4 h-4" />
                                {user?.branch || "Branch Admin"}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
