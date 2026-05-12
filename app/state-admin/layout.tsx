"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import axios from "axios"
import useSWR from "swr"
import NotificationDropdown from "@/components/NotificationDropdown"
import ConfirmModal from "@/app/components/ConfirmModal"
import { useTheme } from "@/contexts/ThemeContext"
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    MoreVertical,
    User,
    Palette,
    TrendingUp,
    Package,
    Share2,
    ShoppingCart,
    BadgePercent,
    ShieldCheck,
    MapPin,
    Link2,
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/state-admin/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/state-admin/products", icon: Package },
    { name: "Offers", href: "/state-admin/offers", icon: BadgePercent },
    { name: "Branch Admins", href: "/state-admin/area-managers", icon: Users },
    { name: "Agents", href: "/state-admin/agents", icon: Share2 },
    { name: "Earnings", href: "/state-admin/earnings", icon: TrendingUp },
    { name: "My Referrals", href: "/state-admin/my-referrals", icon: Link2 },
    { name: "Order Layout", href: "/state-admin/order-layout", icon: ShoppingCart },
    { name: "Profile", href: "/state-admin/profile", icon: Settings },
]

export default function StateAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const { theme } = useTheme()
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    // `mounted` stays false during SSR + first client render so the layout
    // emits identical markup on both sides. Theme-derived inline styles are
    // applied only after hydration to avoid a mismatch (which would otherwise
    // freeze this subtree's attributes — see React docs on hydration errors).
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            try {
                setUser(JSON.parse(userData))
            } catch (e) {
                console.error("Error parsing user data:", e)
            }
        }
    }, [])

    // ────────────────────────────────────────────────────────────────────
    // Live sidebar badges (poll every 5s via SWR). The badge for each item
    // shows the delta between the latest count and the count seen the last
    // time the user visited that page, so opening the page clears it.
    // ────────────────────────────────────────────────────────────────────
    const fetcher = (url: string) => axios.get(url).then(r => r.data)
    const swrOpts = { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }

    const { data: earningsData } = useSWR(
        user?.state
            ? `/api/state-admin/earnings?state=${encodeURIComponent(user.state)}${user.id ? `&adminId=${user.id}` : ""}`
            : null,
        fetcher,
        swrOpts
    )
    const { data: referralsData } = useSWR(
        user?.refer_code
            ? `/api/state-admin/my-direct-referrals?refer_code=${encodeURIComponent(user.refer_code)}`
            : null,
        fetcher,
        swrOpts
    )
    const { data: offersData } = useSWR(
        "/api/additional-commissions/active?role=state",
        fetcher,
        swrOpts
    )

    const earningsCount: number = earningsData?.success ? (earningsData.stats?.totalOrders || 0) : 0
    const myReferralsCount: number = referralsData?.success ? (referralsData.stats?.total_customers || 0) : 0
    const offersCount: number = (offersData?.campaigns?.length ?? offersData?.activeCommissions?.length ?? 0) as number

    const currentCountFor = (name: string): number => {
        switch (name) {
            case "Earnings": return earningsCount
            case "My Referrals": return myReferralsCount
            case "Offers": return offersCount
            default: return 0
        }
    }

    const seenStorageKey = user?.id ? `state_admin_badge_seen_${user.id}` : null
    const [lastSeen, setLastSeen] = useState<Record<string, number>>({})

    useEffect(() => {
        if (!seenStorageKey) return
        try {
            const raw = localStorage.getItem(seenStorageKey)
            if (raw) setLastSeen(JSON.parse(raw))
        } catch (e) {
            console.error("Failed to read badge seen state:", e)
        }
    }, [seenStorageKey])

    useEffect(() => {
        if (!seenStorageKey) return
        let changed = false
        const next: Record<string, number> = { ...lastSeen }

        for (const item of navigationItems) {
            const cur = currentCountFor(item.name)
            const seen = next[item.name] ?? 0
            const onThisPage = pathname.startsWith(item.href)
            if (onThisPage && seen !== cur) {
                next[item.name] = cur
                changed = true
            } else if (seen > cur) {
                next[item.name] = cur
                changed = true
            }
        }

        if (changed) {
            setLastSeen(next)
            try {
                localStorage.setItem(seenStorageKey, JSON.stringify(next))
            } catch (e) {
                console.error("Failed to persist badge seen state:", e)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, seenStorageKey, earningsCount, myReferralsCount, offersCount])

    const badgeFor = (name: string): number => {
        const cur = currentCountFor(name)
        const seen = lastSeen[name] ?? 0
        return Math.max(0, cur - seen)
    }

    const performLogout = () => {
        localStorage.removeItem("affiliate_user")
        localStorage.removeItem("affiliate_token")
        localStorage.removeItem("affiliate_role")
        router.push("/login")
    }

    const initial =
        (user?.name || user?.first_name || "S").charAt(0).toUpperCase()

    return (
        <div
            className="min-h-screen flex overflow-x-hidden"
            style={mounted ? { backgroundColor: theme.background } : undefined}
        >
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? "w-72" : "w-0"
                    } transition-all duration-300 overflow-hidden flex flex-col fixed left-0 top-0 h-screen z-30 shadow-2xl`}
                style={
                    mounted
                        ? {
                            background: theme.sidebar,
                            backgroundImage: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)`,
                        }
                        : undefined
                }
            >
                {/* Brand */}
                <div
                    className="flex items-center justify-between p-6"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                            <ShieldCheck className="w-6 h-6 text-indigo-200" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">
                                State Admin
                            </h1>
                            <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">
                                Workspace
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-white/50 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navigationItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname.startsWith(item.href)
                        const badgeCount = badgeFor(item.name)
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
                                <span className="relative z-10 flex-1">{item.name}</span>
                                {badgeCount > 0 && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white shadow-md ring-2 ring-white/10 animate-in fade-in zoom-in duration-200"
                                        aria-label={`${badgeCount} new`}
                                    >
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer Profile */}
                <div
                    className="p-4 relative"
                    style={{
                        borderTopColor: "rgba(255,255,255,0.2)",
                        borderTopWidth: "1px",
                    }}
                >
                    <div className="flex items-center gap-3 px-4 py-2 mb-2">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {initial}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.name || user?.first_name
                                    ? `${user?.name ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()}`
                                    : "State Admin"}
                            </p>
                            <p className="text-xs text-white/70 truncate">
                                {user?.state || "Administrator"}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors text-white/80"
                            title="More options"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>

                    {showUserMenu && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    router.push("/state-admin/profile")
                                }}
                                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <User className="w-4 h-4 mr-3 text-gray-500" />
                                <span>Profile</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false)
                                    router.push("/state-admin/profile#theme")
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

            {/* Main */}
            <div
                className={`flex-1 flex flex-col ${sidebarOpen ? "ml-72" : "ml-0"
                    } transition-all duration-300 overflow-x-hidden min-w-0`}
            >
                {/* Top Bar */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-indigo-50 px-6 lg:px-8 py-5 sticky top-0 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-gray-400 hover:text-indigo-600 transition-colors lg:hidden"
                            aria-label="Toggle sidebar"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center space-x-4 lg:space-x-6">
                        {user?.id && (
                            <NotificationDropdown
                                userId={user.id}
                                userRole="state"
                            />
                        )}

                        <div className="h-8 w-[1px] bg-gray-200 mx-1 lg:mx-2"></div>

                        <span className="px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            {user?.state || "State Admin"}
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
                    <div className="max-w-[1600px] mx-auto">{children}</div>
                </main>
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
        </div>
    )
}
