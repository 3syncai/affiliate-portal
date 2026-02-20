"use client"
import { useState, FormEvent, useEffect } from "react"
import axios from "axios"
import { UserPlus, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

type FormData = {
    first_name: string
    last_name: string
    email: string
    phone: string
    city: string
    password: string
    confirm_password: string
}

export default function CreateASMPage() {
    const { colors, theme } = useTheme()
    const [formData, setFormData] = useState<FormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        city: "",
        password: "",
        confirm_password: ""
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [stateAdminState, setStateAdminState] = useState("")
    const [availableCities, setAvailableCities] = useState<string[]>([])
    const [loadingCities, setLoadingCities] = useState(false)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setStateAdminState(parsed.state || "")
        }
    }, [])

    // Fetch cities when state is loaded
    useEffect(() => {
        const fetchCities = async () => {
            if (!stateAdminState) return

            try {
                setLoadingCities(true)
                const response = await axios.get(`/api/admin/stores/cities?state=${encodeURIComponent(stateAdminState)}`)
                if (response.data.success) {
                    setAvailableCities(response.data.cities)
                }
            } catch (err) {
                console.error("Error fetching cities:", err)
                setError("Failed to load available cities. Please ensure stores are added for your state.")
            } finally {
                setLoadingCities(false)
            }
        }
        fetchCities()
    }, [stateAdminState])

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

        // Validation
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.city || !formData.password) {
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
            const userData = localStorage.getItem("affiliate_user")
            const stateAdminId = userData ? JSON.parse(userData).id : null

            const response = await axios.post("/api/state-admin/create-asm", {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                phone: formData.phone,
                city: formData.city,
                password: formData.password,
                state_admin_id: stateAdminId
            })

            if (response.data.success) {
                setSuccess(`Area Sales Manager created successfully for ${formData.city}!`)
                setFormData({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    city: "",
                    password: "",
                    confirm_password: ""
                })
            } else {
                setError(response.data.message || "Failed to create ASM")
            }
        } catch (err: unknown) {
            const error = err as Error & { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || error.message || "Failed to create ASM")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Branch Manager</h1>
                <p className="text-gray-600 mt-1">Create a new branch manager for {stateAdminState}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Alert */}
                    {success && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Name Fields */}
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
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
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
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
                                placeholder="Enter last name"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
                            placeholder="Enter email address"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
                            placeholder="Enter 10 digit phone number"
                        />
                    </div>

                    {/* City */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            City <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="city"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            disabled={loadingCities || availableCities.length === 0}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border} disabled:bg-gray-100 disabled:cursor-not-allowed`}
                        >
                            <option value="">
                                {loadingCities
                                    ? "Loading cities..."
                                    : availableCities.length === 0
                                        ? `No cities available for ${stateAdminState}`
                                        : "Select City"}
                            </option>
                            {availableCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        {!loadingCities && availableCities.length === 0 && stateAdminState && (
                            <p className="text-sm text-amber-600 mt-1">
                                No cities found for {stateAdminState}. Please contact admin to add stores for your state.
                            </p>
                        )}
                    </div>

                    {/* Password Fields */}
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
                                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
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
                                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} ${colors.border}`}
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

                    {/* Info Box */}
                    <div className={`${colors.lightBg} border border-${theme}-200 rounded-lg p-4`}>
                        <p className={`text-sm ${colors.secondaryText}`}>
                            <strong>Note:</strong> This Area Sales Manager will be assigned to <strong>{stateAdminState}</strong> state. They will have access to the ASM Dashboard and can manage affiliates in their assigned city.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${colors.primary} ${colors.primaryHover} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Create Branch Manager
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
