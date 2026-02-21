"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Eye, Search } from "lucide-react"

type Agent = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    refer_code: string
    is_approved: boolean
    created_at: string
}

export default function BranchAgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [user, setUser] = useState<{ branch: string } | null>(null)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        if (userData) {
            const parsed = JSON.parse(userData)
            setUser(parsed)
            fetchAgents(parsed.branch)
        }
    }, [])

    const fetchAgents = async (branch: string) => {
        setLoading(true)
        try {
            const response = await axios.get(`/api/branch/agents?branch=${encodeURIComponent(branch)}`)
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

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

    if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-500">Loading partners...</div></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Partners in {user?.branch}</h1>
                <p className="text-gray-600 mt-1">View all partners in your area</p>
            </div>

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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <p className="text-gray-600">Total Partners: <span className="font-bold text-gray-900">{filteredAgents.length}</span></p>
            </div>

            {filteredAgents.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <p className="text-gray-500">No partners found in {user?.branch}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="md:hidden overflow-x-auto -mx-2 px-2">
                        <table className="min-w-[840px] w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Referral Code</th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAgents.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 whitespace-nowrap text-xs font-semibold text-gray-900">
                                            {agent.first_name} {agent.last_name}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600 max-w-[180px] truncate" title={agent.email}>
                                            {agent.email}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                                            {agent.phone || "-"}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-indigo-600">
                                            {agent.refer_code}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${agent.is_approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                                {agent.is_approved ? "Approved" : "Pending"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                                            {formatDate(agent.created_at)}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => setSelectedAgent(agent)}
                                                className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700"
                                            >
                                                <Eye className="w-3 h-3" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAgents.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.first_name} {agent.last_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.phone || "-"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-indigo-600">{agent.refer_code}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${agent.is_approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                                {agent.is_approved ? "Approved" : "Pending"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(agent.created_at)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button onClick={() => setSelectedAgent(agent)} className="text-orange-600 hover:text-orange-900 flex items-center gap-1 ml-auto">
                                                <Eye className="w-4 h-4" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedAgent && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3 md:p-4">
                    <button
                        type="button"
                        aria-label="Close modal overlay"
                        onClick={() => setSelectedAgent(null)}
                        className="absolute inset-0 bg-black/25 md:bg-black/50 backdrop-blur-[1px]"
                    />
                    <div className="relative bg-white rounded-t-2xl md:rounded-lg max-w-lg w-full p-5 md:p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Partner Details</h2>
                        <div className="space-y-3 text-sm">
                            <p><strong>Name:</strong> {selectedAgent.first_name} {selectedAgent.last_name}</p>
                            <p><strong>Email:</strong> {selectedAgent.email}</p>
                            <p><strong>Phone:</strong> {selectedAgent.phone || "-"}</p>
                            <p><strong>Referral Code:</strong> <span className="font-mono text-indigo-600">{selectedAgent.refer_code}</span></p>
                            <p><strong>Status:</strong> {selectedAgent.is_approved ? "Approved" : "Pending"}</p>
                            <p><strong>Joined:</strong> {formatDate(selectedAgent.created_at)}</p>
                        </div>
                        <button onClick={() => setSelectedAgent(null)} className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}
