"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Briefcase, Eye, ToggleLeft, ToggleRight, Search, MapPin } from "lucide-react"

type AreaManager = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    city: string
    state: string
    role: string
    is_active: boolean
    created_at: string
}

export default function AreaManagersPage() {
    const [areaManagers, setAreaManagers] = useState<AreaManager[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedManager, setSelectedManager] = useState<AreaManager | null>(null)
    const [user, setUser] = useState<{ id: string, state: string } | null>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchAreaManagers(parsed.id)
        }
    }, [])

    const fetchAreaManagers = async (stateAdminId: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/state-admin/area-managers?state_admin_id=${stateAdminId}`)
            if (response.data.success) {
                setAreaManagers(response.data.areaManagers)
            }
        } catch (err: unknown) {
            const error = err as Error & { response?: { data?: { message?: string } } };
            console.error("Failed to fetch area managers:", error)
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (managerId: string, currentStatus: boolean) => {
        try {
            await axios.post("/api/state-admin/area-managers/toggle-status", {
                managerId,
                isActive: !currentStatus
            })
            if (user?.id) {
                fetchAreaManagers(user.id)
            }
        } catch (err: unknown) {
            const error = err as Error & { response?: { data?: { message?: string } } };
            console.error("Failed to toggle status:", error)
            alert(error.response?.data?.message || "Failed to update status")
        }
    }

    const filteredManagers = areaManagers.filter(manager =>
        manager.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        manager.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        manager.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        manager.city.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading area managers...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Area Sales Managers</h1>
                    <p className="text-gray-600 mt-1">View and manage area sales managers in {user?.state}</p>
                </div>
                <a
                    href="/state-admin/create-asm"
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Briefcase className="w-4 h-4" />
                    Create New
                </a>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total ASMs</p>
                    <p className="text-2xl font-bold text-gray-900">{areaManagers.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-bold text-green-600">{areaManagers.filter(a => a.is_active).length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Inactive</p>
                    <p className="text-2xl font-bold text-red-600">{areaManagers.filter(a => !a.is_active).length}</p>
                </div>
            </div>

            {/* Table */}
            {filteredManagers.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No area sales managers found</p>
                    <a href="/state-admin/create-asm" className="text-emerald-600 hover:underline mt-2 inline-block">
                        Create your first ASM
                    </a>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredManagers.map((manager) => (
                                    <tr key={manager.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {manager.first_name} {manager.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {manager.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {manager.phone || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                                <MapPin className="w-3 h-3" />
                                                {manager.city}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${manager.is_active
                                                ? "bg-green-100 text-green-700"
                                                : "bg-red-100 text-red-700"
                                                }`}>
                                                {manager.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(manager.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedManager(manager)}
                                                    className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(manager.id, manager.is_active)}
                                                    className={`flex items-center gap-1 ${manager.is_active ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"
                                                        }`}
                                                >
                                                    {manager.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                    {manager.is_active ? "Deactivate" : "Activate"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {selectedManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Area Sales Manager Details</h2>
                        <div className="space-y-3 text-sm">
                            <p><strong>Name:</strong> {selectedManager.first_name} {selectedManager.last_name}</p>
                            <p><strong>Email:</strong> {selectedManager.email}</p>
                            <p><strong>Phone:</strong> {selectedManager.phone || "-"}</p>
                            <p><strong>City:</strong> {selectedManager.city}</p>
                            <p><strong>State:</strong> {selectedManager.state}</p>
                            <p><strong>Role:</strong> {selectedManager.role}</p>
                            <p><strong>Status:</strong> {selectedManager.is_active ? "Active" : "Inactive"}</p>
                            <p><strong>Created:</strong> {formatDate(selectedManager.created_at)}</p>
                        </div>
                        <button
                            onClick={() => setSelectedManager(null)}
                            className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
