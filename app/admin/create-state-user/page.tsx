"use client"

import { useState, useEffect, FormEvent } from "react"
import axios from "axios"
import { UserPlus, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"

type FormData = {
    first_name: string
    last_name: string
    email: string
    phone: string
    state: string
    password: string
    confirm_password: string
}

export default function CreateStateUserPage() {
    const [formData, setFormData] = useState<FormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        state: "",
        password: "",
        confirm_password: ""
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [actionRequired, setActionRequired] = useState("")
    const [success, setSuccess] = useState("")
    const [occupiedStates, setOccupiedStates] = useState<string[]>([])
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [availableStates, setAvailableStates] = useState<string[]>([])
    const [loadingStates, setLoadingStates] = useState(true)

    // Fetch available states from stores and occupied states from existing admins
    useEffect(() => {
        const fetchStates = async () => {
            try {
                setLoadingStates(true)
                const [statesResponse, adminsResponse] = await Promise.all([
                    axios.get("/api/admin/stores/states"),
                    axios.get("/api/admin/state-admins"),
                ])
                if (statesResponse.data.success) {
                    setAvailableStates(statesResponse.data.states)
                }
                if (adminsResponse.data.success) {
                    const takenStates = adminsResponse.data.stateAdmins
                        .map((admin: { state?: string }) => admin.state?.trim().toLowerCase())
                        .filter(Boolean) as string[]
                    setOccupiedStates(takenStates)
                }
            } catch (err) {
                console.error("Error fetching states:", err)
                setError("Failed to load available states. Please ensure stores are added first.")
            } finally {
                setLoadingStates(false)
            }
        }
        fetchStates()
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (name === "state") {
            setActionRequired("")
        }
    }

    const isStateOccupied = (stateName: string) =>
        occupiedStates.includes(stateName.trim().toLowerCase())

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
        setActionRequired("")
        setSuccess("")

        if (isStateOccupied(formData.state)) {
            setActionRequired(
                `One State Admin for One State. ${formData.state} already has a state admin assigned. Please manage the existing admin from State Admins or choose a different state.`
            )
            return
        }

        // Validation
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.state || !formData.password) {
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
            const response = await axios.post("/api/affiliate/admin/create-state-user", {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                phone: formData.phone,
                state: formData.state,
                password: formData.password
            })

            if (response.data.success) {
                const emailNote = response.data.emailSent
                    ? " Welcome email sent with login details."
                    : ""
                setSuccess(
                    `State admin created successfully for ${response.data.user.state}!${emailNote}`,
                )
                setOccupiedStates(prev => [...prev, response.data.user.state.trim().toLowerCase()])
                setFormData({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    state: "",
                    password: "",
                    confirm_password: ""
                })
            } else if (response.data.actionRequired) {
                setActionRequired(response.data.message)
            } else {
                setError(response.data.message || "Failed to create user")
            }
        } catch (err: any) {
            if (err.response?.data?.actionRequired) {
                setActionRequired(err.response.data.message)
            } else {
                setError(err.response?.data?.message || err.message || "Failed to create user")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create State User</h1>
                <p className="text-gray-600 mt-1">Create a new state branch administrator</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Action Required Alert */}
                    {actionRequired && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                    <p className="font-semibold">Action Required</p>
                                    <p className="text-sm mt-1">{actionRequired}</p>
                                </div>
                            </div>
                        </div>
                    )}

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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter 10 digit phone number"
                        />
                    </div>

                    {/* State */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            State <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            disabled={loadingStates || availableStates.length === 0}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {loadingStates
                                    ? "Loading states..."
                                    : availableStates.length === 0
                                        ? "No states available - Add stores first"
                                        : "Select State"}
                            </option>
                            {availableStates.map(state => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>
                        {!loadingStates && availableStates.length === 0 && (
                            <p className="text-sm text-amber-600 mt-1">
                                Please add stores in Store Management first to enable state selection.
                            </p>
                        )}
                        {formData.state && isStateOccupied(formData.state) && (
                            <p className="text-sm text-amber-700 mt-1">
                                This state already has a state admin. One State Admin for One State.
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
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> This user will be created with the role &quot;state&quot; and will have access to the State Admin Dashboard. They will be auto-approved and can login immediately.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Create State User
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
