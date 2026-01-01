"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Settings, Save } from "lucide-react"

export default function GSTSettingsPage() {
    const [gstPercentage, setGstPercentage] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchGSTSettings()
    }, [])

    const fetchGSTSettings = async () => {
        setLoading(true)
        try {
            const response = await axios.get('/api/admin/gst-settings')
            const data = response.data
            if (data.success) {
                setGstPercentage(data.gstPercentage || "18")
            }
        } catch (error) {
            console.error('Failed to fetch GST settings', error)
        } finally {
            setLoading(false)
        }
    }

    const saveGSTSettings = async () => {
        if (!gstPercentage || parseFloat(gstPercentage) < 0 || parseFloat(gstPercentage) > 100) {
            alert('Please enter a valid GST percentage (0-100)')
            return
        }

        setSaving(true)
        try {
            const response = await axios.post('/api/admin/gst-settings', { gstPercentage: parseFloat(gstPercentage) })
            const data = response.data
            if (data.success) {
                alert('GST settings saved successfully!')
            } else {
                alert('Failed to save: ' + (data.error || 'Unknown error'))
            }
        } catch (error: any) {
            console.error('Save error:', error)
            alert('An error occurred: ' + (error.response?.data?.error || error.message))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">GST Settings</h1>
                <p className="text-gray-600 mt-1">Configure GST percentage for affiliate commissions</p>
            </div>

            {/* Settings Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <Settings className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">GST Configuration</h2>
                        <p className="text-sm text-gray-500">Set the GST percentage to be applied on affiliate commissions</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="gst-percentage" className="block text-sm font-medium text-gray-700 mb-2">
                            GST Percentage (%)
                        </label>
                        <div className="flex gap-3">
                            <input
                                id="gst-percentage"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={gstPercentage}
                                onChange={(e) => setGstPercentage(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                                placeholder="Enter GST percentage"
                            />
                            <div className="flex items-center px-4 bg-gray-100 rounded-lg">
                                <span className="text-2xl font-bold text-gray-700">%</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            This GST will be applied on all affiliate commission calculations
                        </p>
                    </div>

                    {/* Example Calculation */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-4">
                        <p className="text-sm font-medium text-indigo-900 mb-2">Example Calculation:</p>
                        <div className="text-sm text-indigo-700 space-y-1">
                            <p>• Commission Amount: ₹1,000</p>
                            <p>• GST ({gstPercentage || "0"}%): ₹{((parseFloat(gstPercentage) || 0) * 10).toFixed(2)}</p>
                            <p className="font-semibold border-t border-indigo-300 pt-2 mt-2">
                                • Total Payable: ₹{(1000 + ((parseFloat(gstPercentage) || 0) * 10)).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={saveGSTSettings}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Saving...' : 'Save GST Settings'}
                    </button>
                </div>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Important Information</h3>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>GST will be calculated on top of the commission amount</li>
                    <li>Changes will apply to all new commission calculations</li>
                    <li>Existing pending commissions will not be affected</li>
                    <li>Standard GST rate in India is 18%</li>
                </ul>
            </div>
        </div>
    )
}
