"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Lock, Calendar, Building, Palette } from "lucide-react"
import ThemeSelector from "@/components/ThemeSelector"
import { useTheme } from "@/contexts/ThemeContext"

type UserData = {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    state?: string;
    city?: string;
    branch?: string;
    created_at: string;
}

export default function BranchProfilePage() {
    const router = useRouter()
    const { theme } = useTheme()
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'info' | 'security' | 'theme'>('info')

    useEffect(() => {
        // Check URL hash for theme tab
        if (window.location.hash === '#theme') {
            setActiveTab('theme')
        }

        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")

        if (!userData || role !== "branch") {
            router.push("/login")
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4 lg:space-y-6 px-1 sm:px-0">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Area Profile</h1>
                <p className="text-sm lg:text-base text-gray-600 mt-1">View your account information and security details</p>
            </div>

            {/* Profile Card with Photo */}
            <div className="bg-white rounded-xl lg:rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-4 sm:gap-6">
                    <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.sidebar})` }}>
                            {(user?.first_name || 'B').charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 w-full">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{user?.first_name} {user?.last_name}</h2>
                        <p className="text-sm sm:text-base text-gray-600 break-all">{user?.email}</p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 mt-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Building className="w-3 h-3 mr-1" />
                                {user?.branch || 'Branch Admin'}
                            </span>
                            <span className="text-xs sm:text-sm text-gray-500 flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                Active User
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <User className="w-4 h-4" />
                                <span className="sm:hidden">Info</span>
                                <span className="hidden sm:inline">Personal Information</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'security'
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Lock className="w-4 h-4" />
                                <span>Security</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('theme')}
                            className={`min-w-fit px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'theme'
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            style={activeTab === 'theme' ? { borderColor: theme.primary, color: theme.primary } : {}}
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Palette className="w-4 h-4" />
                                <span>Theme</span>
                            </div>
                        </button>
                    </nav>
                </div>

                <div className="p-4 sm:p-6">
                    {/* Personal Information Tab */}
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                                            {user?.first_name} {user?.last_name}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                                            {user?.email || 'Not set'}
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Area Location
                                    </label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                                            {user?.branch || 'Not set'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> To update your profile information, please contact the system administrator.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
                                <Lock className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Password & Security</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Your account is secured. Contact admin for password resets.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <Lock className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-gray-900">Password</p>
                                                <p className="text-xs text-gray-500">Managed by Administrator</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Secure</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Theme Tab */}
                    {activeTab === 'theme' && (
                        <div className="space-y-6">
                            <ThemeSelector />
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    <strong>Tip:</strong> Your theme preference is saved automatically and will be applied across all pages and devices.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Account Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Account Type</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">Branch Manager</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-lg font-semibold text-green-600 mt-1">Active</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Area</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{user?.branch || '-'}</div>
                </div>
            </div>
        </div>
    )
}
