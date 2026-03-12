"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Menu,
    X,
    MoreVertical,
    User,
    Palette,
    TrendingUp,
    Bell,
    Package,
    Share2,
    ShoppingCart
} from "lucide-react"

const navigationItems = [
    {
        title: "Dashboard",
        href: "/state-admin/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Area Managers",
        href: "/state-admin/area-managers",
        icon: Users,
    },
    {
        title: "ASM Management",
        href: "/state-admin/asm-management",
        icon: User,
    },
    {
        title: "Agents",
        href: "/state-admin/agents",
        icon: Share2,
    },
    {
        title: "Products",
        href: "/state-admin/products",
        icon: Package,
    },
    {
        title: "Order Layout",
        href: "/state-admin/order-layout",
        icon: ShoppingCart,
    },
    {
        title: "Earnings",
        href: "/state-admin/earnings",
        icon: TrendingUp,
    },
    {
        title: "Profile",
        href: "/state-admin/profile",
        icon: Settings,
    },
]

export default function StateAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [user, setUser] = useState<any>(null)
    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            setUser(JSON.parse(userData))
        }
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("affiliate_user")
        localStorage.removeItem("affiliate_token")
        localStorage.removeItem("affiliate_role")
        router.push("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50 flex overflow-hidden">
            {/* Sidebar for Desktop */}
            <aside
                className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-20"
                    }`}
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className={`flex items-center gap-3 ${!isSidebarOpen && "hidden"}`}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200">
                            <Users className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <span className="font-bold text-gray-900 block leading-tight">State Admin</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Workspace</span>
                        </div>
                    </div>
                    {!isSidebarOpen && (
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto">
                            <Users className="text-white w-6 h-6" />
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
                    {navigationItems.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group relative ${isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "group-hover:scale-110 transition-transform"}`} />
                                {isSidebarOpen && <span className="font-semibold text-sm">{item.title}</span>}
                                {!isSidebarOpen && (
                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                        {item.title}
                                    </div>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-600 hover:bg-red-50 transition-all group ${!isSidebarOpen && "justify-center"
                            }`}
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        {isSidebarOpen && <span className="font-semibold text-sm">Logout</span>}
                    </button>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="mt-4 w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Mobile Header and Menu */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-40">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Users className="text-white w-5 h-5" />
                        </div>
                        <span className="font-bold text-gray-900 text-sm">State Admin</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </header>

                {/* Mobile Navigation Drawer */}
                <div
                    className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div
                        className={`absolute left-0 top-0 h-full w-4/5 max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                            }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                                    <Users className="text-white w-6 h-6" />
                                </div>
                                <span className="font-bold text-gray-900">State Admin</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <nav className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-100px)]">
                            {navigationItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${pathname === item.href
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-bold">{item.title}</span>
                                </Link>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-red-600 hover:bg-red-50 mt-4 font-bold"
                            >
                                <LogOut className="w-5 h-5" />
                                <span>Logout</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Desktop Top Header Bar */}
                <header className="hidden md:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-8 z-30">
                    <div className="flex-1 flex items-center">
                        <div className="relative w-96">
                            {/* Potential search or breadcrumbs could go here */}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center border border-blue-200 shadow-sm">
                                    <span className="text-blue-700 font-bold text-sm">
                                        {user?.name?.substring(0, 1).toUpperCase() || "S"}
                                    </span>
                                </div>
                                <div className="text-left hidden lg:block">
                                    <p className="text-sm font-bold text-gray-900 leading-none">{user?.name || "State Admin"}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-semibold">{user?.state || "Administrator"}</p>
                                </div>
                            </button>

                            {isProfileOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileOpen(false)}
                                    ></div>
                                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                                    <span className="text-white font-bold">{user?.name?.substring(0, 1).toUpperCase() || "S"}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{user?.name || "State Admin"}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{user?.email || "admin@example.com"}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <Link
                                                href="/state-admin/profile"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all font-semibold"
                                            >
                                                <User className="w-4 h-4 text-gray-400" />
                                                Edit Profile
                                            </Link>
                                            <Link
                                                href="/state-admin/settings"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all font-semibold"
                                            >
                                                <Palette className="w-4 h-4 text-gray-400" />
                                                Appearance
                                            </Link>
                                            <div className="my-1 border-t border-gray-100"></div>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-all font-semibold"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar relative z-0">
                    <div className="p-4 md:p-8 max-w-[1600px] mx-auto min-h-full transition-all duration-300">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
