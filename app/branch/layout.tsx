"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import useSWR from "swr"
import NotificationDropdown from "@/components/NotificationDropdown"
import ConfirmModal from "@/app/components/ConfirmModal"
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
    Link2,
    BadgePercent
} from "lucide-react"

const navigationItems = [
    { name: "Dashboard", href: "/branch/dashboard", icon: LayoutDashboard },
    { name: "Products", href: "/branch/products", icon: Package },
    { name: "Offers", href: "/branch/offers", icon: BadgePercent },
    { name: "Partner Request", href: "/branch/affiliate-request", icon: UserCheck },
    { name: "Partners in ASM", href: "/branch/agents", icon: Users },
    { name: "My Earnings", href: "/branch/earnings", icon: TrendingUp },
    { name: "My Referrals", href: "/branch/my-referrals", icon: Link2 },
    { name: "Pending Payout", href: "/branch/pending-payout", icon: Clock },
    { name: "Order Layout", href: "/branch/order-layout", icon: ShoppingBag },
    { name: "Notifications", href: "/branch/notifications", icon: Bell },
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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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
        } catch (e) {
            console.error("Error parsing user data:", e)
            router.push("/login")
        } finally {
            setLoading(false)
        }
    }, [router])

    // ────────────────────────────────────────────────────────────────────
    // Live sidebar badges (poll every 5s via SWR)
    // ────────────────────────────────────────────────────────────────────
    const fetcher = (url: string) => axios.get(url).then(r => r.data)
    const swrOpts = { refreshInterval: 5000, revalidateOnFocus: true, keepPreviousData: true }

    const { data: notifData } = useSWR(
        user?.id ? `/api/notifications?recipientId=${user.id}&recipientRole=branch` : null,
        fetcher,
        swrOpts
    )
    const { data: statsData } = useSWR(
        user?.branch ? `/api/branch/stats?branch=${encodeURIComponent(user.branch)}` : null,
        fetcher,
        swrOpts
    )
    const { data: payoutsData } = useSWR(
        user?.branch ? `/api/branch/withdrawals?branch=${encodeURIComponent(user.branch)}&status=PENDING` : null,
        fetcher,
        swrOpts
    )
    const { data: referralsData } = useSWR(
        user?.refer_code ? `/api/branch/my-direct-referrals?refer_code=${encodeURIComponent(user.refer_code)}` : null,
        fetcher,
        swrOpts
    )
    const { data: offersData } = useSWR(
        "/api/additional-commissions/active?role=branch",
        fetcher,
        swrOpts
    )
    const { data: earningsData } = useSWR(
        user?.branch
            ? `/api/branch/earnings?branch=${encodeURIComponent(user.branch)}${user.id ? `&adminId=${user.id}` : ""}`
            : null,
        fetcher,
        swrOpts
    )

    // Keep the existing `unreadCount` state in sync with SWR data so other
    // parts of the layout that already read it stay correct.
    useEffect(() => {
        if (typeof notifData?.unreadCount === "number") setUnreadCount(notifData.unreadCount)
    }, [notifData])

    const partnerRequestCount: number = statsData?.success ? (statsData.stats?.pendingApproval || 0) : 0
    const pendingPayoutCount: number = payoutsData?.success ? (payoutsData.withdrawals?.length || 0) : 0
    const myReferralsCount: number = referralsData?.success ? (referralsData.stats?.total_customers || 0) : 0
    const offersCount: number = (offersData?.campaigns?.length ?? offersData?.activeCommissions?.length ?? 0) as number
    const notifCount: number = typeof notifData?.unreadCount === "number" ? notifData.unreadCount : 0
    const myEarningsCount: number = earningsData?.success ? (earningsData.stats?.totalOrders || 0) : 0

    const currentCountFor = (name: string): number => {
        switch (name) {
            case "Partner Request": return partnerRequestCount
            case "Pending Payout": return pendingPayoutCount
            case "My Referrals": return myReferralsCount
            case "My Earnings": return myEarningsCount
            case "Offers": return offersCount
            case "Notifications": return notifCount
            default: return 0
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // "Seen" tracking - badge only shows the delta since the user last
    // visited the page, so visiting clears it. Persisted in localStorage
    // per-user so it survives reloads.
    // ────────────────────────────────────────────────────────────────────
    const seenStorageKey = user?.id ? `branch_badge_seen_${user.id}` : null
    const [lastSeen, setLastSeen] = useState<Record<string, number>>({})

    // Hydrate from localStorage once user.id is known
    useEffect(() => {
        if (!seenStorageKey) return
        try {
            const raw = localStorage.getItem(seenStorageKey)
            if (raw) setLastSeen(JSON.parse(raw))
        } catch (e) {
            console.error("Failed to read badge seen state:", e)
        }
    }, [seenStorageKey])

    // When the user is on a page, mark its count as "seen". Also clamp any
    // stale seen counts that are now larger than the live count (e.g. after
    // approving requests) so future increments register as new deltas.
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
        // lastSeen intentionally omitted from deps - including it would cause
        // a feedback loop because this effect updates lastSeen.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        pathname,
        seenStorageKey,
        partnerRequestCount,
        pendingPayoutCount,
        myReferralsCount,
        myEarningsCount,
        offersCount,
        notifCount,
    ])

    const badgeFor = (name: string): number => {
        const cur = currentCountFor(name)
        const seen = lastSeen[name] ?? 0
        return Math.max(0, cur - seen)
    }

    const performLogout = () => {
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
                style={{
                    background: theme.sidebar,
                    backgroundImage: `linear-gradient(to bottom, ${theme.sidebar}, ${theme.sidebar}dd)`
                }}
            >
                <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                            <Building className="w-6 h-6 text-indigo-200" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">Area Sales Manager</h1>
                            <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">Workspace</p>
                        </div>ˍ
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
                </div>
            </aside>

            <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-72" : "ml-0"} transition-all duration-300 overflow-x-hidden min-w-0`}>
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
                            <NotificationDropdown userId={user.id} userRole="branch" />
                        )}

                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>

                        <span className="px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                            <Building className="w-3.5 h-3.5" />
                            {user?.branch || "Branch Admin"}
                        </span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 scroll-smooth">
                    {children}
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
