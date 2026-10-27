"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Eye, Search, X } from "lucide-react"

type Agent = {
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

export default function ASMAgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchAgents(parsed.city, parsed.state)
        }
    }, [])

    const fetchAgents = async (city: string, state?: string) => {
        setLoading(true)
        try {
            let url = `/api/asm/agents?city=${encodeURIComponent(city)}`
            if (state) url += `&state=${encodeURIComponent(state)}`
            const response = await axios.get(url)
            if (response.data.success) {
                setAgents(response.data.agents)
            }
        } catch (error) {
            console.error("Failed to fetch agents:", error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAgents = agents.filter(agent =>
        agent.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.refer_code.toLowerCase().includes(searchTerm.toLowerCase())
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
                <div className="text-lg text-gray-500">Loading partners...</div>
            </div>
        )
    }

    return (
        <div className="space-y-4 sm:space-y-6 min-w-0">
            <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Partners in {user?.city}</h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">View all Oweg Partners in your area</p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or referral code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <p className="text-gray-600 text-sm sm:text-base">
                    Total Partners: <span className="font-bold text-gray-900">{filteredAgents.length}</span>
                </p>
            </div>

            {/* Partners Table */}
            {filteredAgents.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
                    <p className="text-gray-500">No partners found in {user?.city}</p>
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                        {filteredAgents.map((agent) => (
                            <div key={agent.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">
                                            {agent.first_name} {agent.last_name}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{agent.email || "-"}</p>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full ${agent.is_approved
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                        }`}>
                                        {agent.is_approved ? "Approved" : "Pending"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                    <div className="min-w-0">
                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">ASM</p>
                                        <p className="truncate text-blue-600 font-medium">{agent.branch || "-"}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Referral</p>
                                        <p className="font-mono text-indigo-600 truncate">{agent.refer_code}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Phone</p>
                                        <p className="truncate">{agent.phone || "-"}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Joined</p>
                                        <p>{formatDate(agent.created_at)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAgent(agent)}
                                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-900 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    <Eye className="w-4 h-4" /> View
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ASM</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredAgents.map((agent) => (
                                        <tr key={agent.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {agent.first_name} {agent.last_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-blue-600 font-medium">{agent.branch || "-"}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {agent.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm text-indigo-600">{agent.refer_code}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-full ${agent.is_approved
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-yellow-100 text-yellow-700"
                                                    }`}>
                                                    {agent.is_approved ? "Approved" : "Pending"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(agent.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => setSelectedAgent(agent)}
                                                    className="text-blue-600 hover:text-blue-900 flex items-center gap-1 ml-auto"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* View Partner Modal */}
            {selectedAgent && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setSelectedAgent(null)}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 max-h-[90dvh] overflow-hidden flex flex-col">
                        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100 gap-3">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 min-w-0 truncate">Partner Details</h2>
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 sm:p-6 space-y-3 text-sm min-h-0">
                            <p><strong>Name:</strong> {selectedAgent.first_name} {selectedAgent.last_name}</p>
                            <p><strong>Email:</strong> {selectedAgent.email}</p>
                            <p><strong>Phone:</strong> {selectedAgent.phone || "-"}</p>
                            <p><strong>Referral Code:</strong> <span className="font-mono text-indigo-600">{selectedAgent.refer_code}</span></p>
                            <p><strong>ASM:</strong> <span className="text-blue-600 font-medium">{selectedAgent.branch || "-"}</span></p>
                            <p><strong>Status:</strong> {selectedAgent.is_approved ? "Approved" : "Pending"}</p>
                            <p><strong>Joined:</strong> {formatDate(selectedAgent.created_at)}</p>
                        </div>
                        <div className="border-t border-gray-100 px-4 sm:px-6 py-4 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className="w-full sm:w-auto px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
