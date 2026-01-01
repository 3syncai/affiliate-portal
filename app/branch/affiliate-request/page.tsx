"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { UserCheck, UserX, Eye, Search, Clock } from "lucide-react"

type User = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    refer_code: string
    branch: string
    is_approved: boolean
    created_at: string
}

export default function BranchAffiliateRequestPage() {
    const [pendingUsers, setPendingUsers] = useState<User[]>([])
    const [approvedUsers, setApprovedUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending")
    const [branchData, setBranchData] = useState<any>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setBranchData(parsed)
            fetchUsers(parsed.branch)
        }
    }, [])

    const fetchUsers = async (branch: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/branch/affiliate-users?branch=${encodeURIComponent(branch)}`)
            if (response.data.success) {
                setPendingUsers(response.data.pending || [])
                setApprovedUsers(response.data.approved || [])
            }
        } catch (error) {
            console.error("Failed to fetch users:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (userId: string) => {
        try {
            await axios.post(`/api/branch/affiliate-users/${userId}/approve`)
            if (branchData?.branch) fetchUsers(branchData.branch)
        } catch (error) {
            console.error("Failed to approve user:", error)
            alert("Failed to approve user")
        }
    }

    const handleReject = async (userId: string) => {
        if (!confirm("Are you sure you want to reject this affiliate?")) return
        try {
            await axios.post(`/api/branch/affiliate-users/${userId}/reject`)
            if (branchData?.branch) fetchUsers(branchData.branch)
        } catch (error) {
            console.error("Failed to reject user:", error)
            alert("Failed to reject user")
        }
    }

    const currentUsers = activeTab === "pending" ? pendingUsers : approvedUsers
    const filteredUsers = currentUsers.filter(user =>
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.refer_code?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

    if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-500">Loading...</div></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Affiliate Requests</h1>
                <p className="text-gray-600 mt-1">Approve or reject affiliate requests for {branchData?.branch}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab("pending")}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "pending" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                    Pending ({pendingUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab("approved")}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "approved" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                    Approved ({approvedUsers.length})
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or referral code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                </div>
            </div>

            {/* Table */}
            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No {activeTab} affiliate requests</p>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone || "-"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-indigo-600">{user.refer_code}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.created_at)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setSelectedUser(user)} className="text-blue-600 hover:text-blue-900 flex items-center gap-1">
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                                {activeTab === "pending" && (
                                                    <>
                                                        <button onClick={() => handleApprove(user.id)} className="text-green-600 hover:text-green-900 flex items-center gap-1">
                                                            <UserCheck className="w-4 h-4" /> Approve
                                                        </button>
                                                        <button onClick={() => handleReject(user.id)} className="text-red-600 hover:text-red-900 flex items-center gap-1">
                                                            <UserX className="w-4 h-4" /> Reject
                                                        </button>
                                                    </>
                                                )}
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
            {selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Affiliate Details</h2>
                        <div className="space-y-3 text-sm">
                            <p><strong>Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                            <p><strong>Email:</strong> {selectedUser.email}</p>
                            <p><strong>Phone:</strong> {selectedUser.phone || "-"}</p>
                            <p><strong>Referral Code:</strong> <span className="font-mono text-indigo-600">{selectedUser.refer_code}</span></p>
                            <p><strong>Branch:</strong> {selectedUser.branch}</p>
                            <p><strong>Status:</strong> {selectedUser.is_approved ? "Approved" : "Pending"}</p>
                            <p><strong>Applied:</strong> {formatDate(selectedUser.created_at)}</p>
                        </div>
                        <div className="flex gap-2 mt-6">
                            {!selectedUser.is_approved && (
                                <>
                                    <button onClick={() => { handleApprove(selectedUser.id); setSelectedUser(null); }} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                        Approve
                                    </button>
                                    <button onClick={() => { handleReject(selectedUser.id); setSelectedUser(null); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                        Reject
                                    </button>
                                </>
                            )}
                            <button onClick={() => setSelectedUser(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
