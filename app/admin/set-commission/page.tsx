"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Edit, Trash2, Package, Tag, Boxes, Type, Save, X, Maximize2, Minimize2, AlertTriangle } from "lucide-react"
import axios from "axios"

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
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [collections, setCollections] = useState<FilterOption[]>([])
  const [types, setTypes] = useState<FilterOption[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [entitySearch, setEntitySearch] = useState("")
  const [showEntityDropdown, setShowEntityDropdown] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; id: string | null }>({ show: false, id: null })
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  useEffect(() => {
    loadCommissions()
    loadProducts()
  }, [])

  const loadCommissions = async () => {
    try {
      const response = await axios.get("/api/affiliate/admin/commission-settings")
      const data = response.data
      console.log('Loaded commissions:', data.commissions)
      setCommissions(data.commissions || [])
    } catch (error: any) {
      console.error("Failed to fetch commissions:", error)
      const errorMessage = error.response?.data?.message || error.message || "Unknown error"
      alert(`Error loading commissions: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const response = await axios.get("/api/affiliate/admin/products")
      const data = response.data
      setProducts(data.products || [])

      // Extract unique categories, collections, and types
      const uniqueCategories = new Map<string, FilterOption>()
      const uniqueCollections = new Map<string, FilterOption>()
      const uniqueTypes = new Map<string, FilterOption>()

      data.products?.forEach((product: any) => {
        product.categories?.forEach((cat: any) => {
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
      alert(`Error loading products: ${errorMessage}. Please check if the backend server is running.`)
    }
  }

  const handleSave = async () => {
    // Validate entity_id
    if (!formData.entity_id || formData.entity_id.trim() === "") {
      alert("Please select a " + formData.commission_type)
      return
    }

    // Validate commission_rate
    if (!formData.commission_rate || formData.commission_rate.trim() === "") {
      alert("Please enter a commission rate")
      return
    }

    const trimmedRate = formData.commission_rate.trim()

    // Check if trimmed rate is empty
    if (!trimmedRate || trimmedRate === "") {
      alert("Please enter a commission rate")
      return
    }

    const commissionRate = parseFloat(trimmedRate)

    if (isNaN(commissionRate) || !isFinite(commissionRate)) {
      alert("Commission rate must be a valid number")
      return
    }

    if (commissionRate < 0 || commissionRate > 100) {
      alert("Commission rate must be between 0 and 100")
      return
    }

    // Double-check we have a valid number
    if (typeof commissionRate !== 'number') {
      alert("Please enter a valid commission rate")
      return
    }

    console.log("Validated commission rate:", commissionRate, "Type:", typeof commissionRate)

    setSaving(true)
    try {
      let response

      if (editingCommission) {
        // Update existing commission
        const requestBody = {
          commission_rate: commissionRate,
        }
        console.log("Updating commission:", requestBody)

        response = await axios.put(`/api/affiliate/admin/commission-settings/${editingCommission.id}`, requestBody)
      } else {
        // Create new commission
        const body: any = {
          commission_rate: commissionRate,
        }

        // Set the appropriate entity ID based on commission type
        if (formData.commission_type === "product") {
          body.product_id = formData.entity_id
        } else if (formData.commission_type === "category") {
          body.category_id = formData.entity_id
        } else if (formData.commission_type === "collection") {
          body.collection_id = formData.entity_id
        } else if (formData.commission_type === "type") {
          body.type_id = formData.entity_id
        }

        const requestBody = {
          ...body,
          commission_rate: commissionRate, // Ensure it's explicitly set as a number
        }

        console.log("Creating commission with body:", JSON.stringify(requestBody, null, 2))
        console.log("Commission rate value:", commissionRate, "Type:", typeof commissionRate)
        console.log("Request body stringified:", JSON.stringify(requestBody))

        response = await axios.post("/api/affiliate/admin/commission-settings", requestBody)

        console.log("Response status:", response.status)
      }

      await loadCommissions()
      setShowForm(false)
      setEditingCommission(null)
      setFormData({
        commission_type: "product",
        entity_id: "",
        commission_rate: "",
      })
      alert(editingCommission ? "Commission updated successfully" : "Commission created successfully")
    } catch (error: any) {
      console.error("Failed to save commission:", error)
      const errorMessage = error.response?.data?.message || error.message || "Unknown error"
      alert(`Error saving commission: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (commissionId: string) => {
    setDeleteConfirmation({ show: true, id: commissionId })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation.id) return

    try {
      console.log('Deleting commission:', deleteConfirmation.id)
      const response = await axios.delete(`/api/affiliate/admin/commission-settings/${deleteConfirmation.id}`)
      console.log('Delete response:', response.data)

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete commission')
      }

      await loadCommissions()
      setNotification({ show: true, message: 'Commission deleted successfully', type: 'success' })
      setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000)
    } catch (error: any) {
      console.error("Failed to delete commission:", error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error"
      setNotification({ show: true, message: `Error: ${errorMessage}`, type: 'error' })
      setTimeout(() => setNotification({ show: false, message: '', type: 'error' }), 5000)
    } finally {
      setDeleteConfirmation({ show: false, id: null })
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
    setProductSearch("")
    setShowProductDropdown(false)
    setIsMaximized(false)
    setEntitySearch("")
    setShowEntityDropdown(false)
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
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-xl shadow-2xl mx-auto transform transition-all ${isMaximized ? 'w-full h-full max-w-none' : 'max-w-lg w-full'
            }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCommission ? "Edit Commission" : "Add Commission"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-100"
                  title={isMaximized ? "Minimize" : "Maximize"}
                >
                  {isMaximized ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-100"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={`px-6 py-5 space-y-5 overflow-y-auto ${isMaximized ? 'h-[calc(100vh-180px)]' : 'max-h-[calc(100vh-200px)]'
              }`}>
              {/* Commission Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Type
                </label>
                <select
                  value={formData.commission_type}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      commission_type: e.target.value as any,
                      entity_id: "",
                    })
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 transition-shadow"
                  disabled={!!editingCommission}
                >
                  <option value="product">Product</option>
                  <option value="category">Category</option>
                  <option value="collection">Collection</option>
                  <option value="type">Type</option>
                </select>
              </div>

              {/* Entity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.commission_type === "product"
                    ? "Product"
                    : formData.commission_type === "category"
                      ? "Category"
                      : formData.commission_type === "collection"
                        ? "Collection"
                        : "Type"}
                </label>

                {/* Product Selector with Search and Images */}
                {formData.commission_type === "product" ? (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                      />
                    </div>

                    {showProductDropdown && (
                      <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto ${isMaximized ? 'max-h-96' : 'max-h-64'
                        }`}>
                        {products
                          .filter(p =>
                            productSearch === "" ||
                            p.title?.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, entity_id: product.id })
                                setProductSearch(product.title)
                                setShowProductDropdown(false)
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-gray-100 last:border-0"
                            >
                              {product.thumbnail ? (
                                <img
                                  src={product.thumbnail}
                                  alt={product.title}
                                  className="w-12 h-12 object-cover rounded-md border border-gray-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {product.title}
                                </p>
                                {product.collection?.title && (
                                  <p className="text-xs text-gray-500 truncate">
                                    {product.collection.title}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        {products.filter(p =>
                          productSearch === "" ||
                          p.title?.toLowerCase().includes(productSearch.toLowerCase())
                        ).length === 0 && (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                              No products found
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Custom Searchable Dropdown for Category, Collection, Type */
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                      <input
                        type="text"
                        placeholder={`Search ${formData.commission_type}...`}
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        onFocus={() => setShowEntityDropdown(true)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                      />
                    </div>

                    {showEntityDropdown && (
                      <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto ${isMaximized ? 'max-h-96' : 'max-h-64'
                        }`}>
                        {/* Category options */}
                        {formData.commission_type === "category" &&
                          categories
                            .filter(cat =>
                              entitySearch === "" ||
                              cat.name?.toLowerCase().includes(entitySearch.toLowerCase())
                            )
                            .map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, entity_id: cat.id })
                                  setEntitySearch(cat.name || "")
                                  setShowEntityDropdown(false)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-gray-100 last:border-0"
                              >
                                <Tag className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900">
                                  {cat.name}
                                </span>
                              </button>
                            ))}

                        {/* Collection options */}
                        {formData.commission_type === "collection" &&
                          collections
                            .filter(col =>
                              entitySearch === "" ||
                              col.title?.toLowerCase().includes(entitySearch.toLowerCase())
                            )
                            .map((col) => (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, entity_id: col.id })
                                  setEntitySearch(col.title || "")
                                  setShowEntityDropdown(false)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-gray-100 last:border-0"
                              >
                                <Boxes className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900">
                                  {col.title}
                                </span>
                              </button>
                            ))}

                        {/* Type options */}
                        {formData.commission_type === "type" &&
                          types
                            .filter(type =>
                              entitySearch === "" ||
                              type.value?.toLowerCase().includes(entitySearch.toLowerCase())
                            )
                            .map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, entity_id: type.id })
                                  setEntitySearch(type.value || "")
                                  setShowEntityDropdown(false)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-gray-100 last:border-0"
                              >
                                <Type className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900">
                                  {type.value}
                                </span>
                              </button>
                            ))}

                        {/* No results message */}
                        {((formData.commission_type === "category" && categories.filter(cat =>
                          entitySearch === "" ||
                          cat.name?.toLowerCase().includes(entitySearch.toLowerCase())
                        ).length === 0) ||
                          (formData.commission_type === "collection" && collections.filter(col =>
                            entitySearch === "" ||
                            col.title?.toLowerCase().includes(entitySearch.toLowerCase())
                          ).length === 0) ||
                          (formData.commission_type === "type" && types.filter(type =>
                            entitySearch === "" ||
                            type.value?.toLowerCase().includes(entitySearch.toLowerCase())
                          ).length === 0)) && (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                              No {formData.commission_type} found
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Commission Rate */}
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
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData((prev) => ({ ...prev, commission_rate: value }))
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    setFormData((prev) => ({ ...prev, commission_rate: value }))
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  placeholder="e.g., 5 for 5%"
                  required
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Enter a percentage (0-100). For example, 5 means 5% commission.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingCommission ? "Update" : "Create"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto transform transition-all">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Commission</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this commission? This will permanently remove the commission rate.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmation({ show: false, id: null })}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg px-6 py-4 flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
            {notification.type === 'success' ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
              {notification.message}
            </span>
          </div>
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {commissions.length === 0
                      ? "No commissions set. Click 'Add Commission' to create one."
                      : "No commissions match your search."}
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {commission.product_id && <Package className="w-4 h-4 mr-2 text-blue-500" />}
                        {commission.category_id && <Tag className="w-4 h-4 mr-2 text-green-500" />}
                        {commission.collection_id && <Boxes className="w-4 h-4 mr-2 text-purple-500" />}
                        {commission.type_id && <Type className="w-4 h-4 mr-2 text-orange-500" />}
                        <span className="text-sm font-medium text-gray-900">
                          {getEntityType(commission)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="text-sm text-gray-900 break-words" title={getEntityName(commission)}>
                        {getEntityName(commission)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-indigo-600">
                        {commission.commission_rate}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleEdit(commission)
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDelete(commission.id)
                          }}
                          className="text-red-600 hover:text-red-900"
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

