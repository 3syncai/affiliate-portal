"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
    LayoutDashboard,
    LogOut,
    Package,
    BadgePercent,
    User,
    Menu,
    X,
} from "lucide-react"
import ConfirmModal from "@/app/components/ConfirmModal"

interface UserNavbarProps {
    userName?: string
}

const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Package },
    { href: "/offers", label: "Offers", icon: BadgePercent },
    { href: "/dashboard/profile", label: "Profile", icon: User },
] as const

export default function UserNavbar({ userName }: UserNavbarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [menuPath, setMenuPath] = useState<string | null>(null)
    const mobileOpen = menuPath === pathname

    const performLogout = () => {
        localStorage.removeItem("affiliate_token")
        localStorage.removeItem("affiliate_user")
        localStorage.removeItem("affiliate_role")
        router.push("/login")
    }

    const closeMobileMenu = () => setMenuPath(null)

    const isActive = (path: string) => {
        if (path === "/dashboard") {
            return (
                pathname === "/dashboard" ||
                (pathname.startsWith("/dashboard/") &&
                    !pathname.startsWith("/dashboard/profile"))
            )
        }
        return pathname === path || pathname.startsWith(`${path}/`)
    }

    useEffect(() => {
        if (!mobileOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuPath(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [mobileOpen])

    const linkClass = (path: string) =>
        `flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
            isActive(path)
                ? "bg-green-50 text-green-700"
                : "text-gray-600 hover:bg-green-50 hover:text-green-700"
        }`

    const mobileLinkClass = (path: string) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
            isActive(path)
                ? "bg-emerald-50 text-emerald-800"
                : "text-gray-700 hover:bg-slate-50"
        }`

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:gap-8">
                        <Link
                            href="/dashboard"
                            className="flex items-center min-w-0"
                        >
                            <span className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                Sales Executive
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center space-x-1">
                            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className={linkClass(href)}
                                >
                                    <Icon size={18} />
                                    <span>{label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                        {userName && (
                            <span className="text-gray-600 text-sm hidden sm:block max-w-[140px] lg:max-w-none truncate">
                                Welcome,{" "}
                                <span className="font-semibold text-gray-900">
                                    {userName}
                                </span>
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowLogoutConfirm(true)}
                            className="hidden md:flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                        <button
                            type="button"
                            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-gray-700 hover:bg-slate-100 transition-colors"
                            aria-label={mobileOpen ? "Close menu" : "Open menu"}
                            aria-expanded={mobileOpen}
                            onClick={() =>
                                setMenuPath((p) => (p === pathname ? null : pathname))
                            }
                        >
                            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </div>

            {mobileOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 py-3 space-y-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {userName && (
                            <p className="px-4 py-2 text-sm text-gray-500 truncate">
                                Welcome,{" "}
                                <span className="font-semibold text-gray-900">
                                    {userName}
                                </span>
                            </p>
                        )}
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className={mobileLinkClass(href)}
                                onClick={closeMobileMenu}
                            >
                                <Icon size={20} />
                                <span>{label}</span>
                            </Link>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                closeMobileMenu()
                                setShowLogoutConfirm(true)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-all"
                        >
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            )}

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
        </nav>
    )
}
