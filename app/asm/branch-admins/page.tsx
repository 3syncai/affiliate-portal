"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Building, Eye, ToggleLeft, ToggleRight, Search, MapPin, X, Mail, Phone, Calendar, Shield, BadgeCheck, XCircle } from "lucide-react"

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
            if (parsed.city && parsed.state) {
                fetchBranchAdmins(parsed.city, parsed.state)
            }
        }
    }, [])

    const fetchBranchAdmins = async (city: string, state: string) => {
        setLoading(true)
        try {
            const response = await axios.get(
                `/api/asm/branch-admins?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
            )
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
            if (user?.city && user?.state) {
                fetchBranchAdmins(user.city, user.state)
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
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading Area Sales admins...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Area Sales Admins</h1>
                    <p className="text-gray-600 mt-1">View and manage Area Sales Admins in {user?.city}</p>
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
                        placeholder="Search by name, email, or Asm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total Asm Admins</p>
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
                    <p className="text-gray-500">No Area sales Manger found</p>
                    <a href="/asm/create-branch" className="text-blue-600 hover:underline mt-2 inline-block">
                        Create your first ASM Admin
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asm</th>
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
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedAdmin(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with gradient */}
                        <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-6 pt-6 pb-16">
                            <button
                                onClick={() => setSelectedAdmin(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="text-white">
                                <p className="text-xs uppercase tracking-wider opacity-80 font-medium">Area Sales Manager</p>
                                <h2 className="text-xl font-bold mt-1">Profile Details</h2>
                            </div>
                        </div>

                        {/* Avatar + Name */}
                        <div className="relative px-6 -mt-12">
                            <div className="flex items-end gap-4">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-white shadow-lg flex items-center justify-center text-white text-3xl font-bold">
                                    {selectedAdmin.first_name?.[0]?.toUpperCase()}{selectedAdmin.last_name?.[0]?.toUpperCase()}
                                </div>
                                <div className="pb-2 flex-1 min-w-0">
                                    <h3 className="text-xl font-bold text-gray-900 truncate capitalize">
                                        {selectedAdmin.first_name} {selectedAdmin.last_name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {selectedAdmin.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                <BadgeCheck className="w-3 h-3" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                <XCircle className="w-3 h-3" />
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details list */}
                        <div className="px-6 py-6 space-y-1">
                            <DetailRow
                                icon={<Mail className="w-4 h-4" />}
                                label="Email"
                                value={selectedAdmin.email}
                                iconBg="bg-blue-50 text-blue-600"
                            />
                            <DetailRow
                                icon={<Phone className="w-4 h-4" />}
                                label="Phone"
                                value={selectedAdmin.phone || "—"}
                                iconBg="bg-emerald-50 text-emerald-600"
                            />
                            <DetailRow
                                icon={<Building className="w-4 h-4" />}
                                label="Branch / ASM"
                                value={selectedAdmin.branch || "—"}
                                iconBg="bg-orange-50 text-orange-600"
                            />
                            <DetailRow
                                icon={<MapPin className="w-4 h-4" />}
                                label="Location"
                                value={`${selectedAdmin.city || "—"}, ${selectedAdmin.state || "—"}`}
                                iconBg="bg-rose-50 text-rose-600"
                            />
                            <DetailRow
                                icon={<Shield className="w-4 h-4" />}
                                label="Role"
                                value={<span className="capitalize">{selectedAdmin.role}</span>}
                                iconBg="bg-purple-50 text-purple-600"
                            />
                            <DetailRow
                                icon={<Calendar className="w-4 h-4" />}
                                label="Created"
                                value={formatDate(selectedAdmin.created_at)}
                                iconBg="bg-pink-50 text-pink-600"
                            />
                        </div>

                        {/* Footer actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setSelectedAdmin(null)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    toggleStatus(selectedAdmin.id, selectedAdmin.is_active)
                                    setSelectedAdmin(null)
                                }}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${selectedAdmin.is_active
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-green-50 text-green-600 hover:bg-green-100"
                                    }`}
                            >
                                {selectedAdmin.is_active ? "Deactivate" : "Activate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function DetailRow({
    icon,
    label,
    value,
    iconBg,
}: {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
    iconBg: string
}) {
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-sm text-gray-900 font-medium truncate">{value}</p>
            </div>
        </div>
    )
}
