"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import {
    Eye,
    Search,
    X,
    User as UserIcon,
    Mail,
    Phone,
    MapPin,
    Building2,
    Hash,
    CalendarDays,
    ShieldCheck,
    XCircle,
    Wallet,
    CreditCard,
    Banknote,
    TrendingUp,
    Users,
    ShoppingBag,
    Clock,
} from "lucide-react"
import { formatIST, formatISTDate } from "@/lib/datetime"

type Agent = {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    refer_code: string
    is_agent: boolean
    is_approved: boolean
    rejected_at: string | null
    entry_sponsor: string | null
    branch: string | null
    city: string | null
    state: string | null
    country: string | null
    payment_method: string | null
    bank_name: string | null
    bank_branch: string | null
    ifsc_code: string | null
    account_name: string | null
    account_number: string | null
    upi_id: string | null
    created_at: string | null
    updated_at: string | null
    total_orders: number
    total_commission: number | string
    pending_commission: number | string
    total_referred_customers: number
}

const formatCurrency = (value: number | string | null | undefined) => {
    const n = typeof value === "string" ? parseFloat(value) : (value ?? 0)
    return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

const fullName = (a: Agent) =>
    `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || "Unknown"

const statusInfo = (a: Agent) => {
    if (a.rejected_at) return { label: "Rejected", class: "bg-red-100 text-red-700 border-red-200" }
    if (a.is_approved) return { label: "Approved", class: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    return { label: "Pending", class: "bg-yellow-100 text-yellow-700 border-yellow-200" }
}

export default function BranchAgentsPage() {
    const searchParams = useSearchParams()
    const approvedOnly = searchParams.get("approved") === "true"
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
            fetchAgents(parsed.branch, approvedOnly)
        }
    }, [approvedOnly])

    const fetchAgents = async (branch: string, approved: boolean) => {
        setLoading(true)
        try {
            let url = `/api/branch/agents?branch=${encodeURIComponent(branch)}`
            if (approved) url += "&approved=true"
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

    const filteredAgents = useMemo(
        () =>
            agents.filter((agent) => {
                const q = searchTerm.toLowerCase()
                return (
                    (agent.first_name || "").toLowerCase().includes(q) ||
                    (agent.last_name || "").toLowerCase().includes(q) ||
                    (agent.email || "").toLowerCase().includes(q) ||
                    (agent.phone || "").toLowerCase().includes(q) ||
                    (agent.refer_code || "").toLowerCase().includes(q)
                )
            }),
        [agents, searchTerm]
    )

    if (loading)
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-500">Loading partners...</div>
            </div>
        )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Partners in {user?.branch}</h1>
                <p className="text-gray-600 mt-1">View all partners in your area</p>
            </div>

            {approvedOnly && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                    <p className="text-sm text-amber-900">
                        Showing: <span className="font-semibold">Approved partners only</span>
                        {" "}({filteredAgents.length} record{filteredAgents.length === 1 ? "" : "s"})
                    </p>
                    <Link
                        href="/branch/agents"
                        className="text-sm font-medium text-amber-800 hover:text-amber-950 underline shrink-0"
                    >
                        Show all partners
                    </Link>
                </div>
            )}

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
                <p className="text-gray-600">
                    {approvedOnly ? "Sales Executives" : "Total Partners"}:{" "}
                    <span className="font-bold text-gray-900">{filteredAgents.length}</span>
                </p>
            </div>

            {filteredAgents.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <p className="text-gray-500">No partners found in {user?.branch}</p>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAgents.map((agent) => {
                                    const status = statusInfo(agent)
                                    return (
                                        <tr key={agent.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {fullName(agent)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {agent.email || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {agent.phone || "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-indigo-600">
                                                {agent.refer_code}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-full border ${status.class}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatISTDate(agent.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => setSelectedAgent(agent)}
                                                    className="text-orange-600 hover:text-orange-900 flex items-center gap-1 ml-auto"
                                                >
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedAgent && (
                <PartnerDetailsModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
            )}
        </div>
    )
}

function PartnerDetailsModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
    const status = statusInfo(agent)
    const isBank = agent.payment_method === "Bank Transfer"
    const isUpi = agent.payment_method === "UPI"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            />

            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
                            {fullName(agent).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-gray-900 truncate">{fullName(agent)}</h2>
                            <p className="text-sm text-gray-500 font-mono">{agent.refer_code}</p>
                            <span className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${status.class}`}>
                                {agent.rejected_at ? <XCircle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                {status.label}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Stats */}
                    <Section title="Performance">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Stat icon={<ShoppingBag className="w-4 h-4" />} label="Orders" value={String(agent.total_orders ?? 0)} tone="indigo" />
                            <Stat icon={<Users className="w-4 h-4" />} label="Customers" value={String(agent.total_referred_customers ?? 0)} tone="emerald" />
                            <Stat icon={<TrendingUp className="w-4 h-4" />} label="Earned" value={formatCurrency(agent.total_commission)} tone="green" />
                            <Stat icon={<Clock className="w-4 h-4" />} label="Pending" value={formatCurrency(agent.pending_commission)} tone="amber" />
                        </div>
                    </Section>

                    {/* Contact */}
                    <Section title="Contact Information">
                        <div className="grid gap-3 md:grid-cols-2">
                            <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Full Name" value={fullName(agent)} />
                            <InfoRow icon={<Hash className="w-4 h-4" />} label="Referral Code" value={agent.refer_code} mono />
                            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={agent.email} />
                            <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={agent.phone} />
                        </div>
                    </Section>

                    {/* Location */}
                    <Section title="Location">
                        <div className="grid gap-3 md:grid-cols-2">
                            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Branch" value={agent.branch} />
                            <InfoRow icon={<MapPin className="w-4 h-4" />} label="City" value={agent.city} />
                            <InfoRow icon={<MapPin className="w-4 h-4" />} label="State" value={agent.state} />
                            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Country" value={agent.country || "India"} />
                        </div>
                    </Section>

                    {/* Payment */}
                    <Section title="Payout Method">
                        {!agent.payment_method ? (
                            <p className="text-sm text-gray-500 italic bg-gray-50 rounded-lg p-3 border border-gray-200">
                                The partner has not set up a payout method yet.
                            </p>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                <InfoRow
                                    icon={<Wallet className="w-4 h-4" />}
                                    label="Method"
                                    value={agent.payment_method}
                                />
                                {isBank && (
                                    <>
                                        <InfoRow icon={<Banknote className="w-4 h-4" />} label="Bank Name" value={agent.bank_name} />
                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Branch" value={agent.bank_branch} />
                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="IFSC Code" value={agent.ifsc_code} mono />
                                        <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Account Name" value={agent.account_name} />
                                        <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Account Number" value={agent.account_number} mono />
                                    </>
                                )}
                                {isUpi && (
                                    <InfoRow icon={<CreditCard className="w-4 h-4" />} label="UPI ID" value={agent.upi_id} mono />
                                )}
                            </div>
                        )}
                    </Section>

                    {/* Account meta */}
                    <Section title="Account Details">
                        <div className="grid gap-3 md:grid-cols-2">
                            <InfoRow
                                icon={<CalendarDays className="w-4 h-4" />}
                                label="Joined On"
                                value={formatIST(agent.created_at)}
                            />
                            <InfoRow
                                icon={<CalendarDays className="w-4 h-4" />}
                                label="Last Updated"
                                value={formatIST(agent.updated_at)}
                            />
                            <InfoRow
                                icon={<UserIcon className="w-4 h-4" />}
                                label="Sponsor / Referrer"
                                value={agent.entry_sponsor || "Direct sign-up"}
                                mono={Boolean(agent.entry_sponsor)}
                            />
                            {agent.rejected_at && (
                                <InfoRow
                                    icon={<XCircle className="w-4 h-4" />}
                                    label="Rejected On"
                                    value={formatIST(agent.rejected_at)}
                                />
                            )}
                        </div>
                    </Section>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{title}</h3>
            {children}
        </div>
    )
}

function InfoRow({
    icon,
    label,
    value,
    mono = false,
}: {
    icon: React.ReactNode
    label: string
    value: string | null | undefined
    mono?: boolean
}) {
    return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <div className="flex items-center gap-2 text-gray-900">
                <span className="text-gray-500 flex-shrink-0">{icon}</span>
                <span className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
            </div>
        </div>
    )
}

function Stat({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode
    label: string
    value: string
    tone: "indigo" | "emerald" | "green" | "amber"
}) {
    const tones: Record<string, string> = {
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        green: "bg-green-50 text-green-700 border-green-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
    }
    return (
        <div className={`rounded-lg border px-3 py-3 ${tones[tone]}`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold opacity-80">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-1 text-base font-bold text-gray-900 truncate">{value}</p>
        </div>
    )
}
