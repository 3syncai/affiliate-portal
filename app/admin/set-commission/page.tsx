"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Edit, Trash2, Package, Tag, Boxes, Type, Save, X, ChevronDown, Check } from "lucide-react"
import axios from "axios"
import Image from "next/image"

interface Product {
  id: string
  title: string
  thumbnail?: string
  categories?: { id: string; name: string }[]
  collection?: { id: string; title: string }
  type?: { id: string; value: string }
  variants?: { sku: string }[]
}

interface Commission {
  id: string
  product_id?: string | null
  category_id?: string | null
  collection_id?: string | null
  type_id?: string | null
  commission_rate: number
  product?: { id: string; title: string }
  category?: { id: string; name: string }
  collection?: { id: string; title: string }
  type?: { id: string; value: string }
}

interface FilterOption {
  id: string
  name?: string
  title?: string
  value?: string
}

export default function SetCommissionPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null)
  const [formData, setFormData] = useState({
    commission_type: "product" as "product" | "category" | "collection" | "type",
    entity_id: "",
    commission_rate: "",
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [collections, setCollections] = useState<FilterOption[]>([])
  const [types, setTypes] = useState<FilterOption[]>([])

  // Custom dropdown state
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")

  useEffect(() => {
    loadCommissions()
    loadProducts()
  }, [])

  const loadCommissions = async () => {
    try {
      const response = await axios.get("/api/affiliate/admin/commission-settings")
      const data = response.data
      setCommissions(data.commissions || [])
    } catch (error: any) {
      console.error("Failed to fetch commissions:", error)
      const errorMessage = error.response?.data?.message || error.message || "Unknown error"
      showToast(`Error loading commissions: ${errorMessage}`, "error")
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const response = await axios.get("/api/affiliate/admin/products")
      const data = response.data
      setProducts((data.products as Product[]) || [])

      // Extract unique categories, collections, and types
      const uniqueCategories = new Map<string, FilterOption>()
      const uniqueCollections = new Map<string, FilterOption>()
      const uniqueTypes = new Map<string, FilterOption>()

      data.products?.forEach((product: Product) => {
        product.categories?.forEach((cat: { id: string; name: string }) => {
          if (!uniqueCategories.has(cat.id)) {
            uniqueCategories.set(cat.id, { id: cat.id, name: cat.name })
          }
        })
        if (product.collection) {
          if (!uniqueCollections.has(product.collection.id)) {
            uniqueCollections.set(product.collection.id, {
              id: product.collection.id,
              title: product.collection.title,
            })
          }
        }
        if (product.type) {
          if (!uniqueTypes.has(product.type.id)) {
            uniqueTypes.set(product.type.id, {
              id: product.type.id,
              value: product.type.value,
            })
          }
        }
      })

      setCategories(Array.from(uniqueCategories.values()))
      setCollections(Array.from(uniqueCollections.values()))
      setTypes(Array.from(uniqueTypes.values()))
    } catch (error: any) {
      console.error("Failed to fetch products:", error)
      const errorMessage = error.response?.data?.message || error.message || "Unknown error"
      showToast(`Error loading products: ${errorMessage}`, "error")
    } finally {
      setProductsLoading(false)
    }
  }

  const handleSave = async () => {
    // Validate entity_id
    if (!formData.entity_id || formData.entity_id.trim() === "") {
      showToast("Please select a " + formData.commission_type, "error")
      return
    }

    // Validate commission_rate
    if (!formData.commission_rate || formData.commission_rate.trim() === "") {
      showToast("Please enter a commission rate", "error")
      return
    }

    const trimmedRate = formData.commission_rate.trim()
    const commissionRate = parseFloat(trimmedRate)

    if (isNaN(commissionRate) || !isFinite(commissionRate)) {
      showToast("Commission rate must be a valid number", "error")
      return
    }

    if (commissionRate < 0 || commissionRate > 100) {
      showToast("Commission rate must be between 0 and 100", "error")
      return
    }

    const wasEditing = !!editingCommission
    setSaving(true)
    try {
      let response
      if (editingCommission) {
        // Update existing commission
        const requestBody = { commission_rate: commissionRate }
        response = await axios.put(`/api/affiliate/admin/commission-settings/${editingCommission.id}`, requestBody)
        if (!response.data?.success) throw new Error(response.data?.error || "Update failed")
      } else {
        // Create new commission
        const body: any = { commission_rate: commissionRate }
        if (formData.commission_type === "product") body.product_id = formData.entity_id
        else if (formData.commission_type === "category") body.category_id = formData.entity_id
        else if (formData.commission_type === "collection") body.collection_id = formData.entity_id
        else if (formData.commission_type === "type") body.type_id = formData.entity_id
        
        response = await axios.post("/api/affiliate/admin/commission-settings", body)
        if (!response.data?.success) throw new Error(response.data?.error || "Create failed")
      }

      setShowForm(false)
      setEditingCommission(null)
      setFormData({ commission_type: "product", entity_id: "", commission_rate: "" })
      await loadCommissions()
      showToast(wasEditing ? "Commission updated successfully" : "Commission created successfully", "success")
    } catch (error: any) {
      console.error("Failed to save commission:", error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error"
      showToast(`Error: ${errorMessage}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (commissionId: string) => {
    if (!confirm("Are you sure you want to delete this commission?")) return

    try {
      const response = await axios.delete(`/api/affiliate/admin/commission-settings/${commissionId}`)
      if (!response.data?.success) throw new Error(response.data?.error || "Delete failed")
      await loadCommissions()
      showToast("Commission deleted successfully", "success")
    } catch (error: any) {
      console.error("Failed to delete commission:", error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error"
      showToast(`Error: ${errorMessage}`, "error")
    }
  }

  const handleEdit = (commission: Commission) => {
    setEditingCommission(commission)
    let commissionType: "product" | "category" | "collection" | "type" = "product"
    let entityId = ""

    if (commission.product_id) {
      commissionType = "product"
      entityId = commission.product_id
    } else if (commission.category_id) {
      commissionType = "category"
      entityId = commission.category_id
    } else if (commission.collection_id) {
      commissionType = "collection"
      entityId = commission.collection_id
    } else if (commission.type_id) {
      commissionType = "type"
      entityId = commission.type_id
    }

    setFormData({
      commission_type: commissionType,
      entity_id: entityId,
      commission_rate: commission.commission_rate.toString(),
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCommission(null)
    setFormData({
      commission_type: "product",
      entity_id: "",
      commission_rate: "",
    })
  }

  const getEntityName = (commission: Commission): string => {
    if (commission.product_id && commission.product) {
      return commission.product.title
    } else if (commission.category_id && commission.category) {
      return commission.category.name || "Unknown Category"
    } else if (commission.collection_id && commission.collection) {
      return commission.collection.title || "Unknown Collection"
    } else if (commission.type_id && commission.type) {
      return commission.type.value || "Unknown Type"
    }
    return "Unknown"
  }

  const getEntityType = (commission: Commission): string => {
    if (commission.product_id) return "Product"
    if (commission.category_id) return "Category"
    if (commission.collection_id) return "Collection"
    if (commission.type_id) return "Type"
    return "Unknown"
  }

  const filteredCommissions = commissions.filter((comm) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      getEntityName(comm).toLowerCase().includes(search) ||
      getEntityType(comm).toLowerCase().includes(search) ||
      comm.commission_rate.toString().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading commissions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Set Commission</h1>
          <p className="text-gray-600 mt-1">Manage commission rates for products, categories, collections, and types</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Commission
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === "success" ? "bg-green-600" : "bg-red-600 shadow-red-200 shadow-xl"}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search commissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingCommission ? "Edit Commission" : "Add Commission"}
              </h2>
              <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Type
                </label>
                <select
                  value={formData.commission_type}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      commission_type: e.target.value as "product" | "category" | "collection" | "type",
                      entity_id: "",
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
                  disabled={!!editingCommission}
                >
                  <option value="product">Product</option>
                  <option value="category">Category</option>
                  <option value="collection">Collection</option>
                  <option value="type">Type</option>
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.commission_type === "product"
                    ? "Product"
                    : formData.commission_type === "category"
                      ? "Category"
                      : formData.commission_type === "collection"
                        ? "Collection"
                        : "Type"}
                </label>

                {formData.commission_type === "product" ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-indigo-500"
                    >
                      {(() => {
                        if (!formData.entity_id) return <span className="text-gray-500">Select product</span>;
                        const selectedProduct = products.find(p => p.id === formData.entity_id);
                        return (
                          <div className="flex items-center overflow-hidden">
                            {selectedProduct?.thumbnail && (
                              <div className="relative w-6 h-6 mr-2 flex-shrink-0">
                                <Image
                                  src={selectedProduct.thumbnail}
                                  alt=""
                                  fill
                                  className="rounded object-cover"
                                  unoptimized
                                />
                              </div>
                            )}
                            <span className="truncate">
                              {selectedProduct?.title || "Select Product"}
                            </span>
                          </div>
                        );
                      })()}
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </button>

                    {isProductDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col">
                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white rounded-t-lg">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                              placeholder="Search products..."
                              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                          {productsLoading ? (
                            <div className="px-3 py-4 text-center text-sm text-gray-500 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                              Loading products...
                            </div>
                          ) : (
                            <>
                              {products
                                .filter(p => !productSearchTerm || p.title.toLowerCase().includes(productSearchTerm.toLowerCase()))
                                .map((product) => (
                                  <div
                                    key={product.id}
                                    onClick={() => {
                                      setFormData({ ...formData, entity_id: product.id })
                                      setIsProductDropdownOpen(false)
                                      setProductSearchTerm("")
                                    }}
                                    className={`px-3 py-2 cursor-pointer flex items-center hover:bg-gray-50 ${formData.entity_id === product.id ? "bg-indigo-50" : ""
                                      }`}
                                  >
                                    {product.thumbnail ? (
                                      <div className="relative w-8 h-8 mr-3 flex-shrink-0">
                                        <Image
                                          src={product.thumbnail}
                                          alt=""
                                          fill
                                          className="rounded object-cover bg-gray-100"
                                          unoptimized
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded bg-gray-100 mr-3 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 truncate">{product.title}</div>
                                      <div className="text-xs text-gray-500 truncate">SKU: {product.variants?.[0]?.sku || "N/A"}</div>
                                    </div>
                                    {formData.entity_id === product.id && (
                                      <Check className="w-4 h-4 text-indigo-600 ml-2" />
                                    )}
                                  </div>
                                ))}
                              {products.length > 0 && products.filter(p => !productSearchTerm || p.title.toLowerCase().includes(productSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-3 py-4 text-center text-sm text-gray-500">
                                  No products found
                                </div>
                              )}
                              {products.length === 0 && !productsLoading && (
                                <div className="px-3 py-4 text-center text-sm text-gray-500">
                                  No products available
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={formData.entity_id}
                    onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
                  >
                    <option value="">Select {formData.commission_type}</option>
                    {formData.commission_type === "category" &&
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    {formData.commission_type === "collection" &&
                      collections.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    {formData.commission_type === "type" &&
                      types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.value}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, commission_rate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 5 for 5%"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a percentage (0-100). For example, 5 means 5% commission.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center text-sm font-semibold shadow-md shadow-indigo-100 transition-all"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingCommission ? "Update Commission" : "Create Commission"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission Rate</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                       <Package className="w-8 h-8 text-gray-200" />
                       <p className="font-medium">{commissions.length === 0 ? "No commissions set yet." : "No matching commissions found."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${
                          commission.product_id ? "bg-blue-50 text-blue-600" :
                          commission.category_id ? "bg-emerald-50 text-emerald-600" :
                          commission.collection_id ? "bg-purple-50 text-purple-600" :
                          "bg-orange-50 text-orange-600"
                        }`}>
                          {commission.product_id && <Package className="w-4 h-4" />}
                          {commission.category_id && <Tag className="w-4 h-4" />}
                          {commission.collection_id && <Boxes className="w-4 h-4" />}
                          {commission.type_id && <Type className="w-4 h-4" />}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{getEntityType(commission)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-700">{getEntityName(commission)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {commission.commission_rate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(commission)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(commission.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
