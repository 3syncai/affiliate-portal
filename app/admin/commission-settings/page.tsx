"use client"

import { useState, useEffect } from "react"
import { Percent, Save, RefreshCw } from "lucide-react"

interface CommissionRate {
    id: string
    role_type: string
    commission_percentage: number
    description: string
    updated_at: string
}

export default function CommissionSettingsPage() {
    const [rates, setRates] = useState<CommissionRate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [formData, setFormData] = useState<{ [key: string]: string }>({})

    useEffect(() => {
        fetchRates()
    }, [])

    const fetchRates = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/admin/commission-rates")
            const data = await response.json()
            if (data.success) {
                setRates(data.rates)
                const initialData: { [key: string]: string } = {}
                data.rates.forEach((rate: CommissionRate) => {
                    initialData[rate.role_type] = rate.commission_percentage.toString()
                })
                setFormData(initialData)
            }
        } catch (error) {
            console.error("Error fetching rates:", error)
            setError("Failed to load commission rates")
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (roleType: string, value: string) => {
        // Allow empty string or valid number
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
            setFormData({ ...formData, [roleType]: value })
            setError("")
            setSuccess("")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        // Validate all fields
        const updatedRates = []
        for (const rate of rates) {
            const value = formData[rate.role_type]
            if (!value || value === "") {
                setError("All commission rates are required")
                return
            }

            const numValue = parseFloat(value)
            if (isNaN(numValue) || numValue < 0 || numValue > 100) {
                setError("Commission percentages must be between 0 and 100")
                return
            }

            updatedRates.push({
                role_type: rate.role_type,
                commission_percentage: numValue,
            })
        }

        try {
            setSaving(true)
            const response = await fetch("/api/admin/commission-rates", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rates: updatedRates }),
            })

            const data = await response.json()
            if (data.success) {
                setSuccess("Commission rates updated successfully!")
                fetchRates()
            } else {
                setError(data.error || "Failed to update commission rates")
            }
        } catch (error) {
            console.error("Error updating rates:", error)
            setError("Failed to update commission rates")
        } finally {
            setSaving(false)
        }
    }

    const getRoleLabel = (roleType: string) => {
        switch (roleType) {
            case "affiliate":
                return "Partner Agent"
            case "state":
                return "State Admin"
            case "area":
                return "Branch Manager"
            case "branch":
                return "Area sales Manager"
            default:
                return roleType
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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Commission Settings</h1>
                <p className="text-gray-600 mt-1">
                    Manage commission rates for different admin roles
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Success Alert */}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                            {success}
                        </div>
                    )}

                    {/* Commission Rate Fields */}
                    <div className="space-y-6">
                        {rates.filter(rate => rate.role_type !== 'branch_direct').map((rate) => (
                            <div key={rate.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {getRoleLabel(rate.role_type)}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">{rate.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 max-w-xs">
                                        <input
                                            type="text"
                                            value={formData[rate.role_type] || ""}
                                            onChange={(e) => handleChange(rate.role_type, e.target.value)}
                                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 text-lg font-medium"
                                            placeholder="0.00"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                            <Percent className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Current: <span className="font-medium text-gray-700">{rate.commission_percentage}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> These commission rates will apply to all transactions. Changes take effect immediately after saving.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={fetchRates}
                            disabled={saving}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Commission Rates
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Information Card */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How Commission Works</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                        <span className="font-medium mr-2">•</span>
                        <span><strong>Partner Agent</strong> receives their percentage of the product commission first (e.g., 70% of ₹26 = ₹18.20)</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-medium mr-2">•</span>
                        <span>The <strong>remaining commission</strong> is split among the hierarchy based on their percentages</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-medium mr-2">•</span>
                        <span><strong>Area sales Manager</strong> → <strong>Branch Manager</strong> → <strong>State Admin</strong> each get their share</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-medium mr-2">•</span>
                        <span>Commission percentages must be between <strong>0% and 100%</strong></span>
                    </li>
                </ul>
            </div>
        </div>
    )
}
