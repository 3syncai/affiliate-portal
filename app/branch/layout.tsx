"use client"

import { TouchEvent, useEffect, useRef, useState } from "react"
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
    Link2,
    ChevronDown
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/branch/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/branch/products", icon: Package },
    { name: "Partner Request", href: "/branch/affiliate-request", icon: UserCheck },
    { name: "Partners in ASM", href: "/branch/agents", icon: Users },
    { name: "My Referrals", href: "/branch/my-referrals", icon: Link2 },
    { name: "My Earnings", href: "/branch/earnings", icon: TrendingUp },
    { name: "Pending Payout", href: "/branch/pending-payout", icon: Clock },
    { name: "Order Layout", href: "/branch/order-layout", icon: ShoppingBag },
]




interface UserData {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    branch?: string;
}

export default function BranchLayout({
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
    const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const touchStartXRef = useRef<number | null>(null)
    const touchStartYRef = useRef<number | null>(null)

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

    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setSidebarOpen(false)
        }
    }, [])

    const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
        if (typeof window !== "undefined" && window.innerWidth >= 1024) return
        const touch = e.touches[0]
        touchStartXRef.current = touch.clientX
        touchStartYRef.current = touch.clientY
    }

    const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
        if (typeof window !== "undefined" && window.innerWidth >= 1024) return
        if (touchStartXRef.current === null || touchStartYRef.current === null) return

        const touch = e.changedTouches[0]
        const deltaX = touch.clientX - touchStartXRef.current
        const deltaY = Math.abs(touch.clientY - touchStartYRef.current)

        const horizontalSwipeThreshold = 70
        const verticalTolerance = 60
        const edgeActivationZone = 28

        if (deltaY < verticalTolerance) {
            if (!sidebarOpen && touchStartXRef.current <= edgeActivationZone && deltaX > horizontalSwipeThreshold) {
                setSidebarOpen(true)
            } else if (sidebarOpen && deltaX < -horizontalSwipeThreshold) {
                setSidebarOpen(false)
            }
        }

        touchStartXRef.current = null
        touchStartYRef.current = null
    }

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
        <div
            className="h-screen flex overflow-x-hidden overflow-y-hidden"
            style={{ backgroundColor: theme.background }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <aside
                className={`fixed top-0 left-0 h-screen z-40 shadow-xl overflow-hidden flex flex-col w-72 transform transition-transform duration-300 lg:transition-all ${sidebarOpen ? "translate-x-0 lg:w-72" : "-translate-x-full lg:w-0"} lg:translate-x-0`}
                style={{
                    background: theme.sidebar,
                    backgroundImage: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)`
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                            <Building className="w-6 h-6 text-indigo-200" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">Area Sales Manager</h1>
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
                            {(user?.first_name || 'B').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-xs text-white/70 truncate">{user?.branch}</p>
                        </div>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors text-white/80"
                            title="More options"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                <button
                                    onClick={() => {
                                        setShowUserMenu(false)
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
                </div>
            </aside>

            {sidebarOpen && (
                <button
                    aria-label="Close sidebar"
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 bg-black/30 z-30 lg:hidden"
                />
            )}

            <div className={`flex-1 flex flex-col ml-0 ${sidebarOpen ? "lg:ml-72" : "lg:ml-0"} transition-all duration-300 overflow-x-hidden min-w-0 min-h-0`}>
                <header className="bg-white/80 backdrop-blur-xl border-b border-indigo-50 px-4 py-3 sm:px-6 lg:px-8 lg:py-5 sticky top-0 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors lg:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-6">
                        {/* Notification Bell */}
                        {user?.id && (
                            <NotificationDropdown userId={user.id} userRole="branch" />
                        )}

                        <div className="relative lg:hidden">
                            <button
                                onClick={() => setShowMobileProfileMenu((prev) => !prev)}
                                className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-sm"
                            >
                                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                                    {(user?.first_name || "B").charAt(0).toUpperCase()}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showMobileProfileMenu ? "rotate-180" : "rotate-0"}`}
                                />
                            </button>

                            {showMobileProfileMenu && (
                                <>
                                    <button
                                        aria-label="Close profile menu"
                                        onClick={() => setShowMobileProfileMenu(false)}
                                        className="fixed inset-0 z-30 bg-transparent"
                                    />
                                    <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white shadow-xl z-40 overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                            <div className="flex items-start gap-3">
                                                <MapPin className="w-4 h-4 text-indigo-600 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
                                                    <p className="text-sm font-medium text-gray-900 mt-0.5">{user?.branch || "Not set"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setShowMobileProfileMenu(false)
                                                router.push("/branch/profile")
                                            }}
                                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            <User className="w-4 h-4 text-gray-500" />
                                            <span>Profile</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setShowMobileProfileMenu(false)
                                                handleLogout()
                                            }}
                                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-gray-100"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>Logout</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="hidden sm:block h-8 w-[1px] bg-gray-200 mx-2"></div>

                        <span className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-sm font-semibold items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                            <Building className="w-3.5 h-3.5" />
                            {user?.branch || "Branch Admin"}
                        </span>
                    </div>
                </header>

                <main data-lenis-prevent className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 scroll-smooth">
                    {children}
                </main>
            </div>
        </div>
    )
}
