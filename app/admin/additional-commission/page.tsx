"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Plus, Trash2, PauseCircle, PlayCircle } from "lucide-react"

type Product = {
  id: string
  title: string
}

type Campaign = {
  id: number
  product_id: string
  product_name: string | null
  additional_rate: number
  target_role: "partner" | "asm" | "branch" | "state" | "all"
  starts_at: string
  ends_at: string | null
  is_active: boolean
  runtime_status: "ACTIVE" | "UPCOMING" | "ENDED" | "INACTIVE"
}

const roleOptions = [
  { value: "partner", label: "Partner" },
  { value: "asm", label: "ASM" },
  { value: "branch", label: "Branch Admin" },
  { value: "state", label: "State Admin" },
  { value: "all", label: "All" },
]

export default function AdditionalCommissionPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    productId: "",
    additionalRate: "",
    startsAt: "",
    endsAt: "",
    targetRole: "partner",
  })

  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of products) {
      map.set(product.id, product.title)
    }
    return map
  }, [products])

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsRes, campaignsRes] = await Promise.all([
        axios.get("/api/affiliate/admin/products"),
        axios.get("/api/admin/additional-commissions"),
      ])

      const productRows = (productsRes.data?.products || []).map((p: any) => ({ id: p.id, title: p.title }))
      setProducts(productRows)
      setCampaigns(campaignsRes.data?.campaigns || [])
    } catch (error) {
      console.error("Failed to load additional commission data:", error)
      alert("Failed to load additional commission data")
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (value: string | null) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const createCampaign = async () => {
    if (!form.productId || !form.additionalRate || !form.startsAt) {
      alert("Please fill Product, Additional Commission, and Start Time")
      return
    }

    setSaving(true)
    try {
      const adminUser = localStorage.getItem("affiliate_user")
      let createdBy: string | null = null
      if (adminUser) {
        const parsed = JSON.parse(adminUser)
        createdBy = parsed?.email || parsed?.name || null
      }

      await axios.post("/api/admin/additional-commissions", {
        productId: form.productId,
        productName: productMap.get(form.productId) || null,
        additionalRate: Number(form.additionalRate),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        targetRole: form.targetRole,
        createdBy,
      })

      setForm({
        productId: "",
        additionalRate: "",
        startsAt: "",
        endsAt: "",
        targetRole: "partner",
      })

      await loadData()
    } catch (error: any) {
      console.error("Failed to create campaign:", error)
      alert(error?.response?.data?.error || "Failed to create campaign")
    } finally {
      setSaving(false)
    }
  }

  const toggleCampaign = async (campaign: Campaign) => {
    try {
      await axios.patch(`/api/admin/additional-commissions/${campaign.id}`, {
        isActive: !campaign.is_active,
      })
      await loadData()
    } catch (error: any) {
      console.error("Failed to toggle campaign:", error)
      alert(error?.response?.data?.error || "Failed to update campaign")
    }
  }

  const deleteCampaign = async (campaignId: number) => {
    if (!confirm("Delete this additional commission campaign?")) return
    try {
      await axios.delete(`/api/admin/additional-commissions/${campaignId}`)
      await loadData()
    } catch (error: any) {
      console.error("Failed to delete campaign:", error)
      alert(error?.response?.data?.error || "Failed to delete campaign")
    }
  }

  const runtimeBadgeClass = (runtimeStatus: Campaign["runtime_status"]) => {
    if (runtimeStatus === "ACTIVE") return "bg-emerald-100 text-emerald-700"
    if (runtimeStatus === "UPCOMING") return "bg-blue-100 text-blue-700"
    if (runtimeStatus === "ENDED") return "bg-gray-100 text-gray-700"
    return "bg-yellow-100 text-yellow-700"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 text-lg">Loading additional commission...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Additional Commission</h1>
        <p className="text-gray-600 mt-1">
          Configure extra commission campaigns by product, time window, and visibility (partner/asm/branch/state/all).
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Campaign</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <select
            value={form.productId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Additional %"
            value={form.additionalRate}
            onChange={(e) => setForm((prev) => ({ ...prev, additionalRate: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />

          <select
            value={form.targetRole}
            onChange={(e) => setForm((prev) => ({ ...prev, targetRole: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />

          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <button
          onClick={createCampaign}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          {saving ? "Saving..." : "Create Campaign"}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Configured Campaigns</h2>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No additional commission campaigns created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Additional %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visible To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {campaign.product_name || productMap.get(campaign.product_id) || campaign.product_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-700">{campaign.additional_rate}%</td>
                    <td className="px-6 py-4 text-sm text-gray-700 capitalize">{campaign.target_role}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(campaign.starts_at)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(campaign.ends_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${runtimeBadgeClass(campaign.runtime_status)}`}>
                        {campaign.runtime_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => toggleCampaign(campaign)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title={campaign.is_active ? "Deactivate" : "Activate"}
                        >
                          {campaign.is_active ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
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
