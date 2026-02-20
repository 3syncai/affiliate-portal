"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Search, Building2 } from "lucide-react"

interface Store {
    id: string
    branch_name: string
    city: string
    state: string
    address: string | null
    contact_phone: string | null
    contact_email: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export default function StoresPage() {
    const [stores, setStores] = useState<Store[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingStore, setEditingStore] = useState<Store | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [formData, setFormData] = useState({
        branch_name: "",
        city: "",
        state: "",
        address: "",
        contact_phone: "",
        contact_email: "",
    })
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchStores()
    }, [])

    const fetchStores = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/admin/stores")
            const data = await response.json()
            if (data.success) {
                setStores(data.stores)
            }
        } catch (error) {
            console.error("Error fetching stores:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        const errors: Record<string, string> = {}
        if (!formData.branch_name.trim()) errors.branch_name = "Branch name is required"
        if (!formData.city.trim()) errors.city = "City is required"
        if (!formData.state.trim()) errors.state = "State is required"

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors)
            return
        }

        try {
            setSubmitting(true)
            const url = editingStore
                ? `/api/admin/stores/${editingStore.id}`
                : "/api/admin/stores"
            const method = editingStore ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const data = await response.json()
            if (data.success) {
                alert(data.message)
                setShowModal(false)
                resetForm()
                fetchStores()
            } else {
                alert(data.error || "Failed to save store")
            }
        } catch (error) {
            console.error("Error saving store:", error)
            alert("Failed to save store")
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (store: Store) => {
        setEditingStore(store)
        setFormData({
            branch_name: store.branch_name,
            city: store.city,
            state: store.state,
            address: store.address || "",
            contact_phone: store.contact_phone || "",
            contact_email: store.contact_email || "",
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to deactivate this store?")) return

        try {
            const response = await fetch(`/api/admin/stores/${id}`, {
                method: "DELETE",
            })
            const data = await response.json()
            if (data.success) {
                alert(data.message)
                fetchStores()
            } else {
                alert(data.error || "Failed to delete store")
            }
        } catch (error) {
            console.error("Error deleting store:", error)
            alert("Failed to delete store")
        }
    }

    const resetForm = () => {
        setFormData({
            branch_name: "",
            city: "",
            state: "",
            address: "",
            contact_phone: "",
            contact_email: "",
        })
        setFormErrors({})
        setEditingStore(null)
    }

    const handleOpenModal = () => {
        resetForm()
        setShowModal(true)
    }

    const filteredStores = stores.filter(
        (store) =>
            store.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.state.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Store Management</h1>
                    <p className="text-gray-600 mt-1">Manage all store locations</p>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Store
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by branch name, city, or state..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Stores Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Branch Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    City
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    State
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStores.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500">No stores found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStores.map((store) => (
                                    <tr key={store.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {store.branch_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                            {store.city}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                            {store.state}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-700">
                                                {store.contact_phone && <div>{store.contact_phone}</div>}
                                                {store.contact_email && (
                                                    <div className="text-gray-500">{store.contact_email}</div>
                                                )}
                                                {!store.contact_phone && !store.contact_email && (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded-full ${store.is_active
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                                    }`}
                                            >
                                                {store.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(store)}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(store.id)}
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

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-5 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingStore ? "Edit Store" : "Add New Store"}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Branch Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.branch_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, branch_name: e.target.value })
                                    }
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400 ${formErrors.branch_name ? "border-red-500" : "border-gray-300"
                                        }`}
                                    placeholder="e.g., Main Branch, Downtown Location"
                                />
                                {formErrors.branch_name && (
                                    <p className="text-red-500 text-sm mt-1">{formErrors.branch_name}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        City <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) =>
                                            setFormData({ ...formData, city: e.target.value })
                                        }
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400 ${formErrors.city ? "border-red-500" : "border-gray-300"
                                            }`}
                                        placeholder="e.g., Mumbai"
                                    />
                                    {formErrors.city && (
                                        <p className="text-red-500 text-sm mt-1">{formErrors.city}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        State <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) =>
                                            setFormData({ ...formData, state: e.target.value })
                                        }
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400 ${formErrors.state ? "border-red-500" : "border-gray-300"
                                            }`}
                                        placeholder="e.g., Maharashtra"
                                    />
                                    {formErrors.state && (
                                        <p className="text-red-500 text-sm mt-1">{formErrors.state}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Address
                                </label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) =>
                                        setFormData({ ...formData, address: e.target.value })
                                    }
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                                    placeholder="Full address (optional)"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contact Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.contact_phone}
                                        onChange={(e) =>
                                            setFormData({ ...formData, contact_phone: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                                        placeholder="e.g., +91 9876543210"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.contact_email}
                                        onChange={(e) =>
                                            setFormData({ ...formData, contact_email: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                                        placeholder="e.g., branch@example.com"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        resetForm()
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    disabled={submitting}
                                >
                                    {submitting ? "Saving..." : editingStore ? "Update Store" : "Add Store"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
