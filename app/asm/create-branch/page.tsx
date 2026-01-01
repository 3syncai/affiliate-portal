"use client"

import { useState, FormEvent, useEffect } from "react"
import axios from "axios"
import { UserPlus, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"

type FormData = {
    first_name: string
    last_name: string
    email: string
    phone: string
    branch: string
    password: string
    confirm_password: string
}

export default function CreateBranchAdminPage() {
    const [formData, setFormData] = useState<FormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        branch: "",
        password: "",
        confirm_password: ""
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [asmData, setAsmData] = useState<any>(null)
    const [availableBranches, setAvailableBranches] = useState<string[]>([])
    const [loadingBranches, setLoadingBranches] = useState(false)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            setAsmData(JSON.parse(userData))
        }
    }, [])

    // Fetch branches when ASM data is loaded
    useEffect(() => {
        const fetchBranches = async () => {
            if (!asmData?.city) return

            try {
                setLoadingBranches(true)
                const response = await axios.get(`/api/admin/stores/branches?city=${encodeURIComponent(asmData.city)}`)
                if (response.data.success) {
                    setAvailableBranches(response.data.branches)
                }
            } catch (err) {
                console.error("Error fetching branches:", err)
                setError("Failed to load available branches. Please ensure stores are added for your city.")
            } finally {
                setLoadingBranches(false)
            }
        }
        fetchBranches()
    }, [asmData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const formatPhone = (value: string) => {
        return value.replace(/\D/g, '').slice(0, 10)
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value)
        setFormData(prev => ({ ...prev, phone: formatted }))
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.branch || !formData.password) {
            setError("All fields are required")
            return
        }

        if (formData.phone.length !== 10) {
            setError("Phone number must be 10 digits")
            return
        }

        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        if (formData.password !== formData.confirm_password) {
            setError("Passwords do not match")
            return
        }

        setLoading(true)

        try {
            const response = await axios.post("/api/asm/create-branch", {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                phone: formData.phone,
                branch: formData.branch,
                password: formData.password,
                asm_id: asmData?.id
            })

            if (response.data.success) {
                setSuccess(`Branch Admin created successfully for ${formData.branch}!`)
                setFormData({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    branch: "",
                    password: "",
                    confirm_password: ""
                })
            } else {
                setError(response.data.message || "Failed to create Branch Admin")
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || "Failed to create Branch Admin")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Branch Admin</h1>
                <p className="text-gray-600 mt-1">Create a new branch administrator for {asmData?.city}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter first name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Last Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter last name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter email address"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter 10 digit phone number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Branch <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="branch"
                            value={formData.branch}
                            onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                            disabled={loadingBranches || availableBranches.length === 0}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {loadingBranches
                                    ? "Loading branches..."
                                    : availableBranches.length === 0
                                        ? `No branches available for ${asmData?.city}`
                                        : "Select branch"}
                            </option>
                            {availableBranches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                        {!loadingBranches && availableBranches.length === 0 && asmData?.city && (
                            <p className="text-sm text-amber-600 mt-1">
                                No branches found for {asmData.city}. Please contact admin to add stores for your city.
                            </p>
                        )}
                        {!loadingBranches && availableBranches.length > 0 && (
                            <p className="mt-1 text-xs text-gray-500">Branch Admin will approve affiliates who register with this branch</p>
                        )}
                    </div>


                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Min 6 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirm_password"
                                    value={formData.confirm_password}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Confirm password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> This Branch Admin will be assigned to <strong>{asmData?.city}</strong> city. They will have access to the Branch Dashboard and can manage affiliates in their branch.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Create Branch Admin
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
