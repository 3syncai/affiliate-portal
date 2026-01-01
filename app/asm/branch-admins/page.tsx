"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Building, Eye, ToggleLeft, ToggleRight, Search, MapPin } from "lucide-react"

type BranchAdmin = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    branch: string
    city: string
    state: string
    role: string
    is_active: boolean
    created_at: string
}

export default function BranchAdminsPage() {
    const [branchAdmins, setBranchAdmins] = useState<BranchAdmin[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAdmin, setSelectedAdmin] = useState<BranchAdmin | null>(null)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchBranchAdmins(parsed.id)
        }
    }, [])

    const fetchBranchAdmins = async (asmId: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/asm/branch-admins?asm_id=${asmId}`)
            if (response.data.success) {
                setBranchAdmins(response.data.branchAdmins)
            }
        } catch (error) {
            console.error("Failed to fetch branch admins:", error)
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (adminId: string, currentStatus: boolean) => {
        try {
            await axios.post("/api/asm/branch-admins/toggle-status", {
                adminId,
                isActive: !currentStatus
            })
            if (user?.id) {
                fetchBranchAdmins(user.id)
            }
        } catch (error) {
            console.error("Failed to toggle status:", error)
            alert("Failed to update status")
        }
    }

    const filteredAdmins = branchAdmins.filter(admin =>
        admin.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.branch.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading branch admins...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Branch Admins</h1>
                    <p className="text-gray-600 mt-1">View and manage branch administrators in {user?.city}</p>
                </div>
                <a
                    href="/asm/create-branch"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Building className="w-4 h-4" />
                    Create New
                </a>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or branch..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total Branch Admins</p>
                    <p className="text-2xl font-bold text-gray-900">{branchAdmins.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-bold text-green-600">{branchAdmins.filter(a => a.is_active).length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Inactive</p>
                    <p className="text-2xl font-bold text-red-600">{branchAdmins.filter(a => !a.is_active).length}</p>
                </div>
            </div>

            {filteredAdmins.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No branch admins found</p>
                    <a href="/asm/create-branch" className="text-blue-600 hover:underline mt-2 inline-block">
                        Create your first Branch Admin
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAdmins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {admin.first_name} {admin.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {admin.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {admin.phone || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                                <Building className="w-3 h-3" />
                                                {admin.branch}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${admin.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {admin.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(admin.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setSelectedAdmin(admin)} className="text-blue-600 hover:text-blue-900 flex items-center gap-1">
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(admin.id, admin.is_active)}
                                                    className={`flex items-center gap-1 ${admin.is_active ? "text-red-600" : "text-green-600"}`}
                                                >
                                                    {admin.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                    {admin.is_active ? "Deactivate" : "Activate"}
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

            {selectedAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Branch Admin Details</h2>
                        <div className="space-y-3 text-sm">
                            <p><strong>Name:</strong> {selectedAdmin.first_name} {selectedAdmin.last_name}</p>
                            <p><strong>Email:</strong> {selectedAdmin.email}</p>
                            <p><strong>Phone:</strong> {selectedAdmin.phone || "-"}</p>
                            <p><strong>Branch:</strong> {selectedAdmin.branch}</p>
                            <p><strong>City:</strong> {selectedAdmin.city}</p>
                            <p><strong>State:</strong> {selectedAdmin.state}</p>
                            <p><strong>Status:</strong> {selectedAdmin.is_active ? "Active" : "Inactive"}</p>
                            <p><strong>Created:</strong> {formatDate(selectedAdmin.created_at)}</p>
                        </div>
                        <button onClick={() => setSelectedAdmin(null)} className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
