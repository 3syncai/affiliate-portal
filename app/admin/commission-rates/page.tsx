"use client"

import { useEffect, useState } from "react"
import { Settings, Save, RefreshCw, Info } from "lucide-react"
import axios from "axios"
import CommissionPoolSummary from "@/app/components/CommissionPoolSummary"
import { commissionBasisPoints, normalCommissionPool, NORMAL_COMMISSION_ROLES, COMMISSION_POOL_LABELS } from "@/lib/commission-pool"

interface CommissionRate {
    id: string
    role_type: string
    commission_percentage: string | number
    description: string
    updated_at: string
}

const roleLabels: Record<string, string> = {
    ...COMMISSION_POOL_LABELS,
    branch_direct: "Legacy direct-referral setting",
}
const roleDescriptions: Record<string, string> = {
    affiliate: "Sales Executive share of the product commission pool",
    branch: "Area Sales Manager (/bm) share of the product commission pool",
    area: "Branch Admin (/asm) share of the product commission pool",
    state: "State Head share of the product commission pool",
    branch_direct: "Separate legacy setting; not an additional share in the normal pool",
}
function errorMessage(error: unknown) {
    return axios.isAxiosError(error) ? error.response?.data?.error || error.message : error instanceof Error ? error.message : "Please try again."
}

export default function CommissionRatesPage() {
    const [rates, setRates] = useState<CommissionRate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editedRates, setEditedRates] = useState<Record<string, string>>({})
    const changedRates = rates.filter(rate => editedRates[rate.role_type] !== String(rate.commission_percentage))
    const hasChanges = changedRates.length > 0
    const poolState = normalCommissionPool(editedRates)
    const normalChanged = changedRates.some(rate => (NORMAL_COMMISSION_ROLES as readonly string[]).includes(rate.role_type))
    const canSave = hasChanges && (!normalChanged || poolState.valid) && changedRates.every(rate => commissionBasisPoints(editedRates[rate.role_type]) !== null)

    useEffect(() => {
        loadRates()
    }, [])

    const loadRates = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success) {
                setRates(response.data.rates)
                // Initialize edited rates with current values
                const initialEdits: Record<string, string> = {}
                response.data.rates.forEach((rate: CommissionRate) => {
                    initialEdits[rate.role_type] = String(rate.commission_percentage)
                })
                setEditedRates(initialEdits)
            }
        } catch (error) {
            console.error("Failed to load commission rates:", error)
            alert("Failed to load commission rates: " + errorMessage(error))
        } finally {
            setLoading(false)
        }
    }

    const handleRateChange = (roleType: string, value: string) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
            setEditedRates(prev => ({ ...prev, [roleType]: value }))
        }
    }

    const handleSave = async () => {
        if (!canSave) return
        setSaving(true)
        try {
            const ratesToUpdate = changedRates.map(rate => ({
                role_type: rate.role_type,
                commission_percentage: editedRates[rate.role_type]
            }))

            const response = await axios.put("/api/admin/commission-rates", {
                rates: ratesToUpdate
            })

            if (response.data.success) {
                alert("Commission rates updated successfully!")
                await loadRates()
            }
        } catch (error) {
            console.error("Failed to save commission rates:", error)
            alert("Failed to save: " + errorMessage(error))
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        const initialEdits: Record<string, string> = {}
        rates.forEach(rate => {
            initialEdits[rate.role_type] = String(rate.commission_percentage)
        })
        setEditedRates(initialEdits)
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Commission Rates</h1>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage commission percentages for different user roles</p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                        disabled={!canSave || saving}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            <CommissionPoolSummary values={editedRates} />

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">How Commission Rates Work:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>The four normal shares must add up to exactly 100% of the product commission pool.</li>
                            <li>Additional commission and bonus campaigns remain separate.</li>
                            <li>Direct referrals continue combining existing normal shares; they do not create a fifth share.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Rates Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {rates.map((rate) => {
                    const isAffiliateOrBranchDirect = rate.role_type === "affiliate" || rate.role_type === "branch_direct"

                    return (
                        <div key={rate.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                                        <Settings className="w-5 h-5 mr-2 text-indigo-600 shrink-0" />
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
                                            id={`commission-rate-${rate.role_type}`}
                                            aria-label={roleLabels[rate.role_type] || rate.role_type}
                                            type="text"
                                            inputMode="decimal"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={editedRates[rate.role_type] ?? ""}
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
                                                This legacy setting is excluded from the normal 100% pool.
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Current Configuration Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
                        <p className="text-sm text-indigo-600 font-medium">Affiliate Direct Referral</p>
                        <p className="text-2xl font-bold text-indigo-900 mt-1">
                            {Number(editedRates["affiliate"] || 0)}%
                        </p>
                        <p className="text-xs text-indigo-700 mt-1">Commission on product sales</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                        <p className="text-sm text-purple-600 font-medium">Area Sales Manager (/bm) Direct Referral</p>
                        <p className="text-2xl font-bold text-purple-900 mt-1">
                            {Number(editedRates["affiliate"] || 0) + Number(editedRates["branch"] || 0)}%
                        </p>
                        <p className="text-xs text-purple-700 mt-1">
                            Sales Executive {Number(editedRates["affiliate"] || 0)}% + own share {Number(editedRates["branch"] || 0)}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
