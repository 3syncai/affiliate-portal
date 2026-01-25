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
    // Extended fields
    gender?: string
    birth_date?: string
    father_name?: string
    mother_name?: string
    qualification?: string
    marital_status?: string
    blood_group?: string
    emergency_person_name?: string
    emergency_person_mobile?: string
    aadhar_card_no?: string
    pan_card_no?: string
    designation?: string
    sales_target?: string
    area?: string
    state?: string
    payment_method?: string
    bank_name?: string
    bank_branch?: string
    ifsc_code?: string
    account_name?: string
    account_number?: string
    address_1?: string
    address_2?: string
    city?: string
    aadhar_card_photo?: string
    pan_card_photo?: string
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedUser(null)}
                    ></div>
                    <div className="relative bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl z-10 transition-transform transform scale-100">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-20">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Affiliate Details</h2>
                                <p className="text-sm text-gray-500">Applicant ID: <span className="font-mono">{selectedUser.id.slice(0, 8)}</span></p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                                <UserX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Personal Information */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                                    Personal Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Full Name</p>
                                        <p className="text-sm font-semibold">{selectedUser.first_name} {selectedUser.last_name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Contact</p>
                                        <p className="text-sm">{selectedUser.email}</p>
                                        <p className="text-sm">{selectedUser.phone || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Parents</p>
                                        <p className="text-sm">F: {selectedUser.father_name || "-"}</p>
                                        <p className="text-sm">M: {selectedUser.mother_name || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Demographics</p>
                                        <p className="text-sm">DOB: {selectedUser.birth_date ? new Date(selectedUser.birth_date).toLocaleDateString() : "-"}</p>
                                        <p className="text-sm capitalize">Gender: {selectedUser.gender || "-"}</p>
                                        <p className="text-sm">Blood: {selectedUser.blood_group || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Status</p>
                                        <p className="text-sm capitalize">Marital: {selectedUser.marital_status || "-"}</p>
                                        <p className="text-sm capitalize">Qual: {selectedUser.qualification || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Emergency Contact</p>
                                        <p className="text-sm">{selectedUser.emergency_person_name || "-"}</p>
                                        <p className="text-sm">{selectedUser.emergency_person_mobile || "-"}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Work & Location */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                                    Work & Location
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Role Details</p>
                                        <p className="text-sm">Branch: {selectedUser.branch}</p>
                                        <p className="text-sm">Area: {selectedUser.area || "-"}</p>
                                        <p className="text-sm">Referral Code: <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">{selectedUser.refer_code}</span></p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Key IDs</p>
                                        <p className="text-sm">Aadhar: {selectedUser.aadhar_card_no || "-"}</p>
                                        <p className="text-sm">PAN: {selectedUser.pan_card_no || "-"}</p>
                                    </div>
                                    <div className="col-span-full space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Address</p>
                                        <p className="text-sm">{selectedUser.address_1} {selectedUser.address_2}</p>
                                        <p className="text-sm">{selectedUser.city}, {selectedUser.state} - {selectedUser.pin_code}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Bank Details */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                                    Bank Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Bank Info</p>
                                        <p className="text-sm font-semibold">{selectedUser.bank_name || "-"}</p>
                                        <p className="text-sm">{selectedUser.bank_branch || "-"}</p>
                                        <p className="text-sm font-mono">{selectedUser.ifsc_code || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Account Details</p>
                                        <p className="text-sm">Name: {selectedUser.account_name || "-"}</p>
                                        <p className="text-sm font-mono">Acc No: {selectedUser.account_number || "-"}</p>
                                        <p className="text-sm">Method: {selectedUser.payment_method || "-"}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Documents */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                                    Documents
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm font-medium mb-2">Aadhar Card</p>
                                        {selectedUser.aadhar_card_photo ? (
                                            <a href={selectedUser.aadhar_card_photo} target="_blank" rel="noopener noreferrer" className="block group relative overflow-hidden rounded-lg border border-gray-200">
                                                <img
                                                    src={selectedUser.aadhar_card_photo}
                                                    alt="Aadhar Card"
                                                    className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <span className="bg-white/90 text-gray-900 px-3 py-1 rounded text-xs font-medium shadow-sm">View Full</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200">
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium mb-2">PAN Card</p>
                                        {selectedUser.pan_card_photo ? (
                                            <a href={selectedUser.pan_card_photo} target="_blank" rel="noopener noreferrer" className="block group relative overflow-hidden rounded-lg border border-gray-200">
                                                <img
                                                    src={selectedUser.pan_card_photo}
                                                    alt="PAN Card"
                                                    className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <span className="bg-white/90 text-gray-900 px-3 py-1 rounded text-xs font-medium shadow-sm">View Full</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200">
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex gap-3 sticky bottom-0">
                            {!selectedUser.is_approved ? (
                                <>
                                    <button onClick={() => { handleApprove(selectedUser.id); setSelectedUser(null); }} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm">
                                        Approve Application
                                    </button>
                                    <button onClick={() => { handleReject(selectedUser.id); setSelectedUser(null); }} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">
                                        Reject
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-green-600 font-medium bg-green-50 rounded-lg py-2 border border-green-200">
                                    <UserCheck className="w-5 h-5 mr-2" /> Application Approved
                                </div>
                            )}
                            <button onClick={() => setSelectedUser(null)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
