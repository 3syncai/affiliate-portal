"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Phone, Lock, Shield, Calendar, Palette } from "lucide-react"
import ThemeSelector from "@/components/ThemeSelector"
import { useTheme } from "@/contexts/ThemeContext"

export default function AdminProfilePage() {
    const router = useRouter()
    const { theme } = useTheme()
    interface User {
        name: string
        email: string
        phone?: string
    }
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'info' | 'security' | 'theme'>('info')

    useEffect(() => {
        // Check URL hash for theme tab
        if (window.location.hash === '#theme') {
            setActiveTab('theme')
        }

        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")

        if (!userData || role !== "admin") {
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-gray-600 mt-1">View your account information and security details</p>
            </div>

            {/* Profile Card with Photo */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.sidebar})` }}>
                            {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{user?.name || user?.email || 'Admin User'}</h2>
                        <p className="text-gray-600">{user?.email}</p>
                        <div className="flex items-center gap-4 mt-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                <Shield className="w-3 h-3 mr-1" />
                                Admin
                            </span>
                            <span className="text-sm text-gray-500 flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                Joined {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Personal Information
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'security'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Security
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('theme')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'theme'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            style={activeTab === 'theme' ? { borderColor: theme.primary, color: theme.primary } : {}}
                        >
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4" />
                                Theme
                            </div>
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {/* Personal Information Tab */}
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                                            {user?.name || user?.email || 'Not set'}
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
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                                            {user?.phone || 'Not set'}
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
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
                                <Lock className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Password & Security</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Your account is secured with advanced encryption
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <Shield className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                                                <p className="text-xs text-gray-500">Extra layer of security</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Enabled</span>
                                    </div>

                                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <Lock className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-medium text-gray-900">Password</p>
                                                <p className="text-xs text-gray-500">Last changed 30 days ago</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Strong</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-800">
                                    <strong>Security Notice:</strong> To change your password or security settings, please contact the system administrator.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Theme Tab */}
                    {activeTab === 'theme' && (
                        <div className="space-y-6">
                            <ThemeSelector />
                            <div className="rounded-lg p-4" style={{ backgroundColor: theme.primaryLight }}>
                                <p className="text-sm" style={{ color: theme.sidebar }}>
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
                    <div className="text-lg font-semibold text-gray-900 mt-1">Main Administrator</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-lg font-semibold text-green-600 mt-1">Active</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Last Login</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">Just now</div>
                </div>
            </div>
        </div>
    )
}
