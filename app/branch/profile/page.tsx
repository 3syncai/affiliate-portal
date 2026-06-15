"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { User, Mail, Phone, Lock, Calendar, Building, Palette, CreditCard, Save, Loader2 } from "lucide-react"
import ThemeSelector from "@/components/ThemeSelector"
import SubAdminKycBankSection from "@/components/SubAdminKycBankSection"
import AdminChangePasswordForm from "@/components/AdminChangePasswordForm"
import { useTheme } from "@/contexts/ThemeContext"

const formatPhoneInput = (value: string) => value.replace(/\D/g, "").slice(0, 10)

const formatPhoneDisplay = (phone: string | null | undefined) => {
    if (!phone) return "Not set"
    const digits = phone.replace(/\D/g, "")
    if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
    return phone
}

export default function BranchProfilePage() {
    const router = useRouter()
    const { theme } = useTheme()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'info' | 'security' | 'kyc' | 'theme'>('info')
    const [phone, setPhone] = useState("")
    const [savingPhone, setSavingPhone] = useState(false)
    const [phoneError, setPhoneError] = useState("")
    const [phoneSuccess, setPhoneSuccess] = useState("")

    const loadProfile = useCallback(async () => {
        const token = localStorage.getItem("affiliate_token")
        if (!token) return

        try {
            const response = await axios.get("/api/branch/me", {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (response.data.success) {
                const profile = response.data.user
                setUser(profile)
                setPhone(formatPhoneInput(profile.phone || ""))
                localStorage.setItem("affiliate_user", JSON.stringify(profile))
            }
        } catch (error) {
            console.error("Failed to load profile:", error)
        }
    }, [])

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")
        const token = localStorage.getItem("affiliate_token")

        if (!userData || !token || role !== "branch") {
            router.push("/login")
            return
        }

        try {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            setPhone(formatPhoneInput(parsed.phone || ""))
        } catch (e) {
            console.error("Error parsing user data:", e)
            router.push("/login")
            return
        }

        void loadProfile().finally(() => setLoading(false))

        if (typeof window !== "undefined" && window.location.hash === "#theme") {
            setActiveTab("theme")
        }
    }, [router, loadProfile])

    const handlePhoneChange = (value: string) => {
        setPhone(formatPhoneInput(value))
        setPhoneError("")
        setPhoneSuccess("")
    }

    const savePhone = async () => {
        setPhoneError("")
        setPhoneSuccess("")

        if (phone.length !== 10) {
            setPhoneError("Enter a complete 10-digit mobile number")
            return
        }

        const token = localStorage.getItem("affiliate_token")
        if (!token) {
            setPhoneError("Session expired. Please log in again.")
            return
        }

        setSavingPhone(true)
        try {
            const response = await axios.patch(
                "/api/branch/me",
                { phone },
                { headers: { Authorization: `Bearer ${token}` } },
            )
            if (response.data.success) {
                const updated = response.data.user
                setUser(updated)
                setPhone(formatPhoneInput(updated.phone || ""))
                localStorage.setItem("affiliate_user", JSON.stringify(updated))
                setPhoneSuccess(response.data.message || "Mobile number saved")
            } else {
                setPhoneError(response.data.message || "Failed to save mobile number")
            }
        } catch (error: unknown) {
            const message =
                axios.isAxiosError(error) && error.response?.data?.message
                    ? String(error.response.data.message)
                    : "Failed to save mobile number"
            setPhoneError(message)
        } finally {
            setSavingPhone(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Area Sales Manager Profile</h1>
                <p className="text-gray-600 mt-1">View your account information and security details</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold" style={{ background: `linear-gradient(to bottom right, ${theme.primary}, ${theme.sidebar})` }}>
                            {(user?.first_name || 'B').charAt(0).toUpperCase()}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{user?.first_name} {user?.last_name}</h2>
                        <p className="text-gray-600">{user?.email}</p>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {formatPhoneDisplay(user?.phone)}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Building className="w-3 h-3 mr-1" />
                                {user?.branch || 'Area Sales Manager'}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                Active User
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                                ? 'border-orange-600 text-orange-600'
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
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Security
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('kyc')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'kyc'
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            style={activeTab === 'kyc' ? { borderColor: theme.primary, color: theme.primary } : {}}
                        >
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                KYC & Bank
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('theme')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'theme'
                                ? 'border-orange-600 text-orange-600'
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
                                        Mobile Number
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                                +91
                                            </span>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                maxLength={10}
                                                value={phone}
                                                onChange={(e) => handlePhoneChange(e.target.value)}
                                                placeholder="Enter 10 digit mobile number"
                                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-gray-900"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={savePhone}
                                            disabled={savingPhone || phone.length !== 10}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: theme.primary }}
                                        >
                                            {savingPhone ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            Save Mobile
                                        </button>
                                    </div>
                                    {phoneError && (
                                        <p className="text-sm text-red-600 mt-2">{phoneError}</p>
                                    )}
                                    {phoneSuccess && (
                                        <p className="text-sm text-orange-600 mt-2">{phoneSuccess}</p>
                                    )}
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
                                    <strong>Note:</strong> You can update your mobile number here. For other profile changes, contact the system administrator.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <AdminChangePasswordForm />
                        </div>
                    )}

                    {activeTab === 'kyc' && (
                        <SubAdminKycBankSection apiBase="/api/branch/me" themePrimary={theme.primary} />
                    )}

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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Account Type</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">Area Sales Manager</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-lg font-semibold text-green-600 mt-1">Active</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Mobile Number</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">
                        {formatPhoneDisplay(user?.phone)}
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Area</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{user?.branch || '-'}</div>
                </div>
            </div>
        </div>
    )
}
