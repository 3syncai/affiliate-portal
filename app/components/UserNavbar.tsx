"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, LogOut, Package } from "lucide-react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface UserNavbarProps {
    userName?: string
}

export default function UserNavbar({ userName }: UserNavbarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem("affiliate_token")
        localStorage.removeItem("affiliate_user")
        localStorage.removeItem("affiliate_role")
        router.push("/login")
    }

    const isActive = (path: string) => pathname === path

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* ── DESKTOP NAV (unchanged) ── */}
                <div className="hidden md:flex justify-between h-16">
                    {/* Left side - Logo and navigation */}
                    <div className="flex items-center space-x-8">
                        <Link href="/dashboard" className="flex items-center space-x-2">
                            <span className="text-xl font-bold text-gray-900">Partner Portal</span>
                        </Link>

                        {/* Navigation Links */}
                        <div className="flex items-center space-x-1">
                            <Link
                                href="/dashboard"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${isActive("/dashboard")
                                    ? "bg-green-50 text-green-700"
                                    : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                                    }`}
                            >
                                <LayoutDashboard size={18} />
                                <span>Dashboard</span>
                            </Link>
                            <Link
                                href="/products"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${isActive("/products")
                                    ? "bg-green-50 text-green-700"
                                    : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                                    }`}
                            >
                                <Package size={18} />
                                <span>Products</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right side - User info and logout */}
                    <div className="flex items-center space-x-4">
                        {userName && (
                            <span className="text-gray-600 text-sm">
                                Welcome, <span className="font-semibold text-gray-900">{userName}</span>
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>

                {/* ── MOBILE NAV ── */}
                <div className="flex md:hidden items-center justify-between h-14">
                    {/* Brand */}
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <LayoutDashboard size={14} className="text-white" />
                        </div>
                        <span className="font-bold text-gray-900 text-base">Partner Portal</span>
                    </Link>

                    {/* Hamburger */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors z-50 overflow-hidden"
                        aria-label="Toggle menu">
                        <div className="relative w-5 h-4 flex flex-col justify-between items-center">
                            <motion.span
                                animate={mobileMenuOpen ? { rotate: 45, y: 7.5 } : { rotate: 0, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="w-5 h-0.5 bg-current rounded-full"
                            />
                            <motion.span
                                animate={mobileMenuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-5 h-0.5 bg-current rounded-full"
                            />
                            <motion.span
                                animate={mobileMenuOpen ? { rotate: -45, y: -7.5 } : { rotate: 0, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="w-5 h-0.5 bg-current rounded-full"
                            />
                        </div>
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="md:hidden overflow-hidden border-t border-gray-100 bg-white"
                    >
                        <div className="px-4 pb-4 pt-1 space-y-1">
                            {/* User info */}
                            {userName && (
                                <div className="flex items-center gap-3 py-3 border-b border-gray-100 mb-2">
                                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <span className="text-emerald-700 font-bold text-sm">
                                            {userName[0]?.toUpperCase() || 'P'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{userName}</p>
                                        <p className="text-xs text-emerald-600 font-medium">Partner Account</p>
                                    </div>
                                </div>
                            )}

                            {/* Nav links */}
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${isActive("/dashboard") ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50"
                                    }`}>
                                <LayoutDashboard size={16} />
                                Dashboard
                            </Link>
                            <Link
                                href="/products"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${isActive("/products") ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50"
                                    }`}>
                                <Package size={16} />
                                Products
                            </Link>
                            <button
                                onClick={() => { setMobileMenuOpen(false); handleLogout() }}
                                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-red-600 hover:bg-red-50 transition-colors">
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}
