"use client"

import { useEffect, useState } from "react"
import { Settings, Save, RefreshCw, Info } from "lucide-react"
import axios from "axios"

interface CommissionRate {
    id: string
    role_type: string
    commission_percentage: number
    description: string
    updated_at: string
}

const roleLabels: Record<string, string> = {
    affiliate: "Affiliate Users",
    branch_direct: "Branch Admin Direct Referrals",
    branch: "Branch Admin (Team Commission)",
    area: "Area Sales Manager",
    state: "State Admin"
}

const roleDescriptions: Record<string, string> = {
    affiliate: "Commission percentage that affiliate agents receive from their product commissions",
    branch_direct: "Additional bonus for branch admins on their direct referrals (added to affiliate base rate)",
    branch: "Commission percentage branch admins earn from their team's affiliate sales",
    area: "Commission percentage area managers earn from affiliate sales in their area",
    state: "Commission percentage state admins earn from affiliate sales in their state"
}

export default function CommissionRatesPage() {
    const [rates, setRates] = useState<CommissionRate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editedRates, setEditedRates] = useState<Record<string, number>>({})
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        loadRates()
    }, [])

    const loadRates = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success) {
                setRates(response.data.rates)
                // Initialize edited rates with current values
                const initialEdits: Record<string, number> = {}
                response.data.rates.forEach((rate: CommissionRate) => {
                    initialEdits[rate.role_type] = rate.commission_percentage
                })
                setEditedRates(initialEdits)
            }
        } catch (error: unknown) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            console.error("Failed to load commission rates:", err)
            alert("Failed to load commission rates: " + (err.response?.data?.error || err.message))
        } finally {
            setLoading(false)
        }
    }

    const handleRateChange = (roleType: string, value: string) => {
        const numValue = parseFloat(value)
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            setEditedRates(prev => ({ ...prev, [roleType]: numValue }))
            setHasChanges(true)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const ratesToUpdate = rates.map(rate => ({
                role_type: rate.role_type,
                commission_percentage: editedRates[rate.role_type]
            }))

            const response = await axios.put("/api/admin/commission-rates", {
                rates: ratesToUpdate
            })

            if (response.data.success) {
                alert("Commission rates updated successfully!")
                await loadRates()
                setHasChanges(false)
            }
        } catch (error: unknown) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            console.error("Failed to save commission rates:", err)
            alert("Failed to save: " + (err.response?.data?.error || err.message))
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        const initialEdits: Record<string, number> = {}
        rates.forEach(rate => {
            initialEdits[rate.role_type] = rate.commission_percentage
        })
        setEditedRates(initialEdits)
        setHasChanges(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading commission rates...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Commission Rates</h1>
                    <p className="text-gray-600 mt-1">Manage commission percentages for different user roles</p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <button
                            onClick={handleReset}
                            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">How Commission Rates Work:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Affiliate:</strong> Base commission percentage for regular affiliate users</li>
                            <li><strong>Branch Admin Direct:</strong> Bonus added to affiliate rate when branch admin refers directly (Total = Affiliate % + Branch Direct %)</li>
                            <li><strong>Branch/Area/State:</strong> Percentage of affiliate team earnings distributed to admins</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Rates Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rates.map((rate) => {
                    const isAffiliateOrBranchDirect = rate.role_type === "affiliate" || rate.role_type === "branch_direct"

                    return (
                        <div key={rate.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                                        {roleLabels[rate.role_type] || rate.role_type}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {roleDescriptions[rate.role_type] || rate.description}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Commission Percentage
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={editedRates[rate.role_type] || 0}
                                            onChange={(e) => handleRateChange(rate.role_type, e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                                            %
                                        </span>
                                    </div>
                                </div>

                                {/* Example calculation */}
                                {isAffiliateOrBranchDirect && (
                                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                                        <p className="font-medium text-gray-700 mb-1">Example:</p>
                                        {rate.role_type === "affiliate" ? (
                                            <p className="text-gray-600">
                                                Product commission: ₹100 → Affiliate gets: <span className="font-semibold text-indigo-600">₹{editedRates[rate.role_type] || 0}</span>
                                            </p>
                                        ) : (
                                            <p className="text-gray-600">
                                                Branch admin direct referral: {editedRates["affiliate"] || 70}% + {editedRates[rate.role_type] || 15}% = <span className="font-semibold text-indigo-600">{(editedRates["affiliate"] || 70) + (editedRates[rate.role_type] || 15)}%</span> total
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="text-xs text-gray-500">
                                    Last updated: {new Date(rate.updated_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Current Configuration Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Configuration Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
                        <p className="text-sm text-indigo-600 font-medium">Affiliate Direct Referral</p>
                        <p className="text-2xl font-bold text-indigo-900 mt-1">
                            {editedRates["affiliate"] || 70}%
                        </p>
                        <p className="text-xs text-indigo-700 mt-1">Commission on product sales</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                        <p className="text-sm text-purple-600 font-medium">Branch Admin Direct Referral</p>
                        <p className="text-2xl font-bold text-purple-900 mt-1">
                            {(editedRates["affiliate"] || 70) + (editedRates["branch_direct"] || 15)}%
                        </p>
                        <p className="text-xs text-purple-700 mt-1">
                            Affiliate {editedRates["affiliate"] || 70}% + Bonus {editedRates["branch_direct"] || 15}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
