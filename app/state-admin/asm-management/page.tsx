"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Users, Mail, MapPin, Search, Plus, Edit2, Trash2 } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { useRouter } from "next/navigation"

type ASM = {
    id: string
    first_name: string
    last_name: string
    email: string
    city: string
    state: string
    created_at: string
}

interface User {
    id: string
    name: string
    email: string
    refer_code: string
    state: string
    role: string
}

export default function ASMManagementPage() {
    const router = useRouter()
    const { colors } = useTheme()
    const [asms, setASMs] = useState<ASM[]>([])
    const [filteredASMs, setFilteredASMs] = useState<ASM[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [userData, setUserData] = useState<User | null>(null)

    useEffect(() => {
        const storedUser = localStorage.getItem("affiliate_user")
        if (storedUser) {
            const parsed = JSON.parse(storedUser)
            setUserData(parsed)
            fetchASMs(parsed.state, parsed.id)
        }
    }, [])

    useEffect(() => {
        if (searchTerm.trim() === "") {
            setFilteredASMs(asms)
        } else {
            const filtered = asms.filter(asm =>
                asm.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asm.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asm.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asm.city.toLowerCase().includes(searchTerm.toLowerCase())
            )
            setFilteredASMs(filtered)
        }
    }, [searchTerm, asms])

    const fetchASMs = async (state: string, adminId: string) => {
        try {
            console.log('Fetching ASMs for state:', state, 'Admin:', adminId);
            const response = await axios.get(`/api/state-admin/asms?state=${encodeURIComponent(state)}&adminId=${encodeURIComponent(adminId)}`)
            console.log('API Response:', response.data);

            if (response.data.success) {
                setASMs(response.data.asms)
                setFilteredASMs(response.data.asms)
                console.log('ASMs loaded:', response.data.asms.length);
            } else {
                console.error('API returned success: false');
            }
        } catch (error) {
            console.error("Failed to fetch ASMs:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    const handleDelete = async (userId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            return
        }

        try {
            const response = await axios.delete(`/api/state-admin/asms/delete?userId=${userId}`)

            if (response.data.success) {
                alert(`✅ ${response.data.message}`)
                // Refresh the list
                if (userData?.state && userData?.id) {
                    fetchASMs(userData.state, userData.id)
                }
            } else {
                alert(`❌ Failed to delete user: ${response.data.error}`)
            }
        } catch (error: unknown) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            console.error("Delete error:", err)
            alert(`❌ Error deleting user: ${err.response?.data?.error || err.message}`)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading ASMs...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Branch Management</h1>
                    <p className="text-gray-600 mt-1">
                        Manage Area Sales Managers in {userData?.state}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/state-admin/create-asm')}
                    className={`px-4 py-2 ${colors.primary} text-white rounded-lg ${colors.primaryHover} transition-colors flex items-center gap-2 cursor-pointer`}
                >
                    <Plus className="w-5 h-5" />
                    Create Branch Manager
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search ASMs by name, email, or city..."
                        className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} focus:border-transparent`}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className={`${colors.secondary} p-3 rounded-lg`}>
                            <Users className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total ASMs</p>
                            <p className="text-2xl font-bold text-gray-900">{asms.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-3 rounded-lg">
                            <MapPin className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Cities Covered</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {new Set(asms.map(a => a.city)).size}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-3 rounded-lg">
                            <Mail className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Showing</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredASMs.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ASM List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">All ASMs</h2>
                </div>

                {filteredASMs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">
                            {searchTerm ? "No ASMs found matching your search" : "No ASMs found in your state"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ASM Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        City
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Joined
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredASMs.map((asm) => (
                                    <tr key={asm.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-10 h-10 rounded-full ${colors.secondary} flex items-center justify-center`}>
                                                    <span className={`${colors.text} font-semibold`}>
                                                        {asm.first_name[0]}{asm.last_name[0]}
                                                    </span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {asm.first_name} {asm.last_name}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{asm.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 text-sm text-gray-900">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                {asm.city}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(asm.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-blue-600 hover:text-blue-900 mr-3">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(asm.id, `${asm.first_name} ${asm.last_name}`)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
