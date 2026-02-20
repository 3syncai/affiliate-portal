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
    Briefcase,
    MapPin,
    UserPlus,
    Building,
    MoreVertical,
    User,
    Palette,
    TrendingUp,
    Bell,
    Package
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/asm/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/asm/products", icon: Package },
    { name: "My Referrals", href: "/asm/my-referrals", icon: Users },
    { name: "Area Sales Manager", href: "/asm/branch-admins", icon: Building },
    { name: "My Earnings", href: "/asm/earnings", icon: TrendingUp },
    { name: "Create Area Sales Manager", href: "/asm/create-branch", icon: UserPlus },
    { name: "Partners in City", href: "/asm/agents", icon: Users },
]


interface UserData {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    city?: string;
    state?: string;
}

export default function ASMLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { theme } = useTheme()
    const [user, setUser] = useState<UserData | null>(null)
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

        if (role !== "asm") {
            router.push("/dashboard")
            return
        }

        try {
            const parsed = JSON.parse(userData)
            setUser(parsed)

            // Fetch notifications
            if (parsed.id) {
                fetch(`/api/notifications?recipientId=${parsed.id}&recipientRole=asm`)
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
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? "w-72" : "w-0"
                    } transition-all duration-300 overflow-hidden flex flex-col fixed h-screen z-30 shadow-2xl`}
                style={{
                    background: theme.sidebar,
                    backgroundImage: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)`
                }}
            >
                <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                            <Briefcase className="w-6 h-6 text-indigo-200" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">Branch Manager</h1>
                            <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">Workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-white/50 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navigationItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                    ? "text-white bg-white/10 shadow-lg backdrop-blur-sm border border-white/10"
                                    : "text-indigo-200/70 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 rounded-r-full"></div>
                                )}
                                <Icon className="w-5 h-5 mr-3" />
                                <span className="relative z-10">{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 relative" style={{ borderTopColor: 'rgba(255,255,255,0.2)', borderTopWidth: '1px' }}>
                    <div className="flex items-center gap-3 px-4 py-2 mb-2">
                        {/* Circular Profile Icon */}
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {(user?.first_name || 'A').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-white/70 truncate">{user?.city}, {user?.state}</p>
                        </div>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors text-white/80"
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
                                    // Navigate to profile page
                                    router.push('/asm/profile')
                                }}
                                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <User className="w-4 h-4 mr-3 text-gray-500" />
                                <span>Profile</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    router.push('/asm/profile#theme')
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
            <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-72" : "ml-0"} transition-all duration-300 overflow-x-hidden min-w-0`}>
                {/* Top Bar */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-indigo-50 px-8 py-5 sticky top-0 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-gray-400 hover:text-indigo-600 transition-colors lg:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* Notification Bell */}
                        {user?.id && (
                            <NotificationDropdown userId={user.id} userRole="asm" />
                        )}

                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>

                        <span className="px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                            <Building className="w-3.5 h-3.5" />
                            {user?.city || "Area Sales Manager"}
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
