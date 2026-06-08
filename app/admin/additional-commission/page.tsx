"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { Plus, Trash2, PauseCircle, PlayCircle, ChevronsUpDown, Check, Search } from "lucide-react"

type Product = {
  id: string
  title: string
  thumbnail: string | null
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
  { value: "partner", label: "Sales Executive" },
  { value: "asm", label: "Area Sales Manager" },
  { value: "branch", label: "Branch Manager" },
  { value: "state", label: "State Admin" },
  { value: "all", label: "All" },
]

export default function AdditionalCommissionPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const productDropdownRef = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState({
    productId: "",
    additionalRate: "",
    startsAt: "",
    endsAt: "",
    targetRole: "partner",
  })

  const productMap = useMemo(() => {
    const map = new Map<string, Product>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.productId) || null,
    [products, form.productId]
  )

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.title.toLowerCase().includes(q))
  }, [products, productSearch])

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!productDropdownRef.current) return
      if (!productDropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsRes, campaignsRes] = await Promise.all([
        axios.get("/api/affiliate/admin/products"),
        axios.get("/api/admin/additional-commissions"),
      ])

      const productRows = (productsRes.data?.products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail || null,
      }))
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
        productName: productMap.get(form.productId)?.title || null,
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
          Configure extra commission campaigns by product, time window, and visibility (sales executive/area sales manager/branch/state/all).
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Campaign</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative lg:col-span-1" ref={productDropdownRef}>
            <button
              type="button"
              onClick={() => setProductDropdownOpen((prev) => !prev)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedProduct?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.thumbnail}
                    alt={selectedProduct.title}
                    className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0" />
                )}
                <span className={`truncate ${selectedProduct ? "text-gray-900" : "text-gray-500"}`}>
                  {selectedProduct ? selectedProduct.title : "Select Product"}
                </span>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-gray-500 shrink-0" />
            </button>

            {productDropdownOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-xl">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product..."
                      className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-md"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-auto p-1">
                  {filteredProducts.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No products found</div>
                  ) : (
                    filteredProducts.map((product) => {
                      const selected = form.productId === product.id
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, productId: product.id }))
                            setProductDropdownOpen(false)
                            setProductSearch("")
                          }}
                          className={`w-full px-2 py-2 rounded-md text-left flex items-center gap-2 hover:bg-gray-50 ${selected ? "bg-indigo-50" : ""
                            }`}
                        >
                          {product.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.thumbnail}
                              alt={product.title}
                              className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0" />
                          )}
                          <span className="text-sm text-gray-900 truncate flex-1">{product.title}</span>
                          {selected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

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
                      <div className="flex items-center gap-3">
                        {productMap.get(campaign.product_id)?.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productMap.get(campaign.product_id)?.thumbnail || ""}
                            alt={campaign.product_name || productMap.get(campaign.product_id)?.title || "Product"}
                            className="w-9 h-9 rounded object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-gray-100 border border-gray-200" />
                        )}
                        <span>
                          {campaign.product_name || productMap.get(campaign.product_id)?.title || campaign.product_id}
                        </span>
                      </div>
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
