"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Eye, Search, Users, Building2, ChevronDown, ChevronUp, X } from "lucide-react"

type Agent = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    refer_code: string
    branch: string
    city: string
    is_approved: boolean
    created_at: string
}

type Branch = {
    name: string
    agents: Agent[]
    count: number
}

export default function StateAgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchAgents(parsed.state)
        }
    }, [])

    const fetchAgents = async (state: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/state-admin/agents?state=${encodeURIComponent(state)}`)
            if (response.data.success) {
                setAgents(response.data.agents)
                setBranches(response.data.branches || [])
                // Expand all branches by default
                const allBranches = new Set<string>(response.data.branches?.map((b: Branch) => b.name) || [])
                setExpandedBranches(allBranches)
            }
        } catch (error) {
            console.error("Failed to fetch agents:", error)
        } finally {
            setLoading(false)
        }
    }

    const toggleBranch = (branchName: string) => {
        const newExpanded = new Set(expandedBranches)
        if (newExpanded.has(branchName)) {
            newExpanded.delete(branchName)
        } else {
            newExpanded.add(branchName)
        }
        setExpandedBranches(newExpanded)
    }

    const filteredBranches = branches.map(branch => ({
        ...branch,
        agents: branch.agents.filter(agent =>
            agent.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.refer_code?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(branch => branch.agents.length > 0 || searchTerm === "")

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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Partners by Branch</h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">View all Oweg Partners grouped by their branch in {user?.state}</p>
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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-lg shrink-0">
                        <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-600">Total Branches</p>
                        <p className="text-2xl font-bold text-gray-900 truncate">{branches.length}</p>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-lg shrink-0">
                        <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-600">Total Partners</p>
                        <p className="text-2xl font-bold text-gray-900 truncate">{agents.length}</p>
                    </div>
                </div>
            </div>

            {/* Branches with Partners */}
            {filteredBranches.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No branches found in {user?.state}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBranches.map((branch) => (
                        <div key={branch.name} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            {/* Branch Header */}
                            <div
                                className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer hover:from-indigo-100 hover:to-purple-100 transition-colors gap-2"
                                onClick={() => toggleBranch(branch.name)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
                                        <Building2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 truncate">{branch.name}</h3>
                                        <p className="text-sm text-gray-600">{branch.count} partners</p>
                                    </div>
                                </div>
                                {expandedBranches.has(branch.name) ? (
                                    <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                                )}
                            </div>

                            {/* Partners list */}
                            {expandedBranches.has(branch.name) && (
                                <>
                                    {/* Mobile cards */}
                                    <div className="md:hidden space-y-3 p-3">
                                        {branch.agents.map((agent) => (
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
                                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Phone</p>
                                                        <p className="truncate">{agent.phone || "-"}</p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Referral</p>
                                                        <p className="font-mono text-indigo-600 truncate">{agent.refer_code}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedAgent(agent)}
                                                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-900 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral Code</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {branch.agents.map((agent) => (
                                                    <tr key={agent.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {agent.first_name} {agent.last_name}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {agent.email}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {agent.phone || "-"}
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
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); }}
                                                                className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1 ml-auto"
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
                                </>
                            )}
                        </div>
                    ))}
                </div>
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
                            <p><strong>Branch:</strong> {selectedAgent.branch || "-"}</p>
                            <p><strong>Referral Code:</strong> <span className="font-mono text-indigo-600">{selectedAgent.refer_code}</span></p>
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
