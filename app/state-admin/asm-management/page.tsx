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

export default function ASMManagementPage() {
    const router = useRouter()
    const { colors } = useTheme()
    const [asms, setASMs] = useState<ASM[]>([])
    const [filteredASMs, setFilteredASMs] = useState<ASM[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [userData, setUserData] = useState<any>(null)

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
        } catch (error: any) {
            console.error("Delete error:", error)
            alert(`❌ Error deleting user: ${error.response?.data?.error || error.message}`)
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Branch Management</h1>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">
                        Manage Area Sales Managers in {userData?.state}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/state-admin/create-asm')}
                    className={`px-4 py-2 ${colors.primary} text-white rounded-lg ${colors.primaryHover} transition-colors flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0`}
                >
                    <Plus className="w-5 h-5" />
                    Create Branch Manager
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                    <div className="flex items-center gap-3">
                        <div className={`${colors.secondary} p-3 rounded-lg shrink-0`}>
                            <Users className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500">Total ASMs</p>
                            <p className="text-2xl font-bold text-gray-900">{asms.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-3 rounded-lg shrink-0">
                            <MapPin className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500">Cities Covered</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {new Set(asms.map(a => a.city)).size}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 min-w-0 sm:col-span-2 md:col-span-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-3 rounded-lg shrink-0">
                            <Mail className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500">Showing</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredASMs.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ASM List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">All ASMs</h2>
                </div>

                {filteredASMs.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">
                            {searchTerm ? "No ASMs found matching your search" : "No ASMs found in your state"}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3 p-4">
                            {filteredASMs.map((asm) => (
                                <div
                                    key={asm.id}
                                    className="rounded-xl border border-gray-200 shadow-sm p-4 min-w-0"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-full ${colors.secondary} flex items-center justify-center shrink-0`}>
                                            <span className={`${colors.text} font-semibold`}>
                                                {asm.first_name[0]}{asm.last_name[0]}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {asm.first_name} {asm.last_name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">{asm.email}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                        <div className="min-w-0">
                                            <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">City</p>
                                            <div className="flex items-center gap-1 truncate">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span className="truncate">{asm.city}</span>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Joined</p>
                                            <p>{formatDate(asm.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-900 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(asm.id, `${asm.first_name} ${asm.last_name}`)}
                                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-900 py-2 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
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
                    </>
                )}
            </div>
        </div>
    )
}
