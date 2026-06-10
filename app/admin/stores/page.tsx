"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Plus,
    Edit2,
    Trash2,
    Search,
    Building2,
    X,
    Loader2,
    CheckCircle2,
    MapPin,
} from "lucide-react"

type PostOfficeOption = {
    name: string
    district: string
    state: string
    block: string
    division: string
    branchType: string
    deliveryStatus: string
    pincode: string
}

interface Store {
    id: string
    branch_name: string
    city: string
    state: string
    pincode: string | null
    address: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

const emptyForm = {
    pincode: "",
    branch_name: "",
    city: "",
    state: "",
    address: "",
}

function composeAddress(office: PostOfficeOption): string {
    const parts = [office.division, office.block, office.district]
        .map((part) => part.trim())
        .filter(Boolean)
    return parts.join(", ")
}

export default function StoresPage() {
    const [stores, setStores] = useState<Store[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingStore, setEditingStore] = useState<Store | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [formData, setFormData] = useState(emptyForm)
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)

    const [postOffices, setPostOffices] = useState<PostOfficeOption[]>([])
    const [selectedOfficeIndex, setSelectedOfficeIndex] = useState<number | null>(null)
    const [pincodeLoading, setPincodeLoading] = useState(false)
    const [pincodeError, setPincodeError] = useState("")
    const [pincodeMessage, setPincodeMessage] = useState("")
    const pincodeFetchRef = useRef(0)
    const lastLookedUpPincode = useRef("")

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

    const applyOfficeToForm = useCallback((office: PostOfficeOption) => {
        const suggestedAddress = composeAddress(office)
        setFormData((prev) => ({
            ...prev,
            branch_name: office.name,
            city: office.district,
            state: office.state,
            address: prev.address.trim() ? prev.address : suggestedAddress,
        }))
    }, [])

    const lookupPincode = useCallback(
        async (pincode: string) => {
            const normalized = pincode.replace(/\D/g, "").slice(0, 6)
            if (normalized.length !== 6) return

            const requestId = ++pincodeFetchRef.current
            setPincodeLoading(true)
            setPincodeError("")
            setPincodeMessage("")
            setPostOffices([])
            setSelectedOfficeIndex(null)

            try {
                const token = localStorage.getItem("affiliate_token")
                const response = await fetch(
                    `/api/admin/stores/pincode?pincode=${normalized}`,
                    {
                        headers: token
                            ? { Authorization: `Bearer ${token}` }
                            : undefined,
                    },
                )
                const data = await response.json()

                if (pincodeFetchRef.current !== requestId) return

                if (!data.success) {
                    setPincodeError(data.message || "Failed to lookup pincode")
                    return
                }

                const offices = (data.offices || []) as PostOfficeOption[]
                setPostOffices(offices)
                setPincodeMessage(
                    data.message ||
                        `Found ${offices.length} location(s) for this pincode.`,
                )

                if (offices.length === 1) {
                    setSelectedOfficeIndex(0)
                    applyOfficeToForm(offices[0])
                } else if (offices.length > 1) {
                    setSelectedOfficeIndex(0)
                    applyOfficeToForm(offices[0])
                }
            } catch (error) {
                if (pincodeFetchRef.current !== requestId) return
                console.error("Pincode lookup failed:", error)
                setPincodeError("Failed to lookup pincode. Please try again.")
            } finally {
                if (pincodeFetchRef.current === requestId) {
                    setPincodeLoading(false)
                }
            }
        },
        [applyOfficeToForm],
    )

    useEffect(() => {
        if (!showModal) return

        const digits = formData.pincode.replace(/\D/g, "")
        if (digits.length !== 6) {
            setPostOffices([])
            setSelectedOfficeIndex(null)
            setPincodeError("")
            setPincodeMessage("")
            if (digits.length < 6) {
                lastLookedUpPincode.current = ""
            }
            return
        }

        if (digits === lastLookedUpPincode.current) {
            return
        }

        const timer = window.setTimeout(() => {
            lastLookedUpPincode.current = digits
            lookupPincode(digits)
        }, 300)

        return () => window.clearTimeout(timer)
    }, [formData.pincode, showModal, lookupPincode])

    const handlePincodeChange = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 6)
        setFormData((prev) => ({ ...prev, pincode: digits }))
        if (digits.length < 6) {
            setPincodeError("")
            setPincodeMessage("")
        }
    }

    const handleOfficeSelect = (index: number) => {
        setSelectedOfficeIndex(index)
        const office = postOffices[index]
        if (office) {
            applyOfficeToForm(office)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const errors: Record<string, string> = {}
        if (!formData.branch_name.trim()) errors.branch_name = "Area sales location is required"
        if (!formData.city.trim()) errors.city = "Branch sales location is required"
        if (!formData.state.trim()) errors.state = "State is required"
        if (formData.pincode && formData.pincode.length !== 6) {
            errors.pincode = "Pincode must be exactly 6 digits"
        }

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
        const storedPincode = store.pincode || ""
        lastLookedUpPincode.current = storedPincode
        setFormData({
            pincode: storedPincode,
            branch_name: store.branch_name,
            city: store.city,
            state: store.state,
            address: store.address || "",
        })
        setPostOffices([])
        setSelectedOfficeIndex(null)
        setPincodeError("")
        setPincodeMessage("")
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
        lastLookedUpPincode.current = ""
        setFormData(emptyForm)
        setFormErrors({})
        setEditingStore(null)
        setPostOffices([])
        setSelectedOfficeIndex(null)
        setPincodeLoading(false)
        setPincodeError("")
        setPincodeMessage("")
    }

    const handleOpenModal = () => {
        resetForm()
        setShowModal(true)
    }

    const handleCloseModal = useCallback(() => {
        setShowModal(false)
        resetForm()
    }, [])

    useEffect(() => {
        if (!showModal) return

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleCloseModal()
        }

        document.addEventListener("keydown", onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"

        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [showModal, handleCloseModal])

    const filteredStores = stores.filter(
        (store) =>
            store.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.state.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    const pincodeLookupOk =
        formData.pincode.length === 6 &&
        !pincodeLoading &&
        !pincodeError &&
        postOffices.length > 0

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

            <div className="bg-white rounded-lg shadow p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by area, branch, or state..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Area Sales Location
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Branch Sales Location
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    State
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
                                    <td colSpan={5} className="px-6 py-12 text-center">
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

            {showModal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="store-modal-title"
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={handleCloseModal}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
                    />
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200">
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white rounded-t-xl">
                            <h2
                                id="store-modal-title"
                                className="text-xl font-bold text-gray-900"
                            >
                                {editingStore ? "Edit Store" : "Add New Store"}
                            </h2>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                aria-label="Close dialog"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pincode
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MapPin className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formData.pincode}
                                        onChange={(e) => handlePincodeChange(e.target.value)}
                                        className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400 font-mono ${formErrors.pincode ? "border-red-500" : pincodeLookupOk ? "border-emerald-500" : "border-gray-300"
                                            }`}
                                        placeholder="e.g. 400001"
                                        maxLength={6}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        {pincodeLoading ? (
                                            <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                                        ) : pincodeLookupOk ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        ) : null}
                                    </div>
                                </div>
                                {formErrors.pincode && (
                                    <p className="text-red-500 text-sm mt-1">{formErrors.pincode}</p>
                                )}
                                {pincodeError && (
                                    <p className="text-red-500 text-sm mt-1">{pincodeError}</p>
                                )}
                                {pincodeMessage && !pincodeError && (
                                    <p className="text-emerald-700 text-sm mt-1">{pincodeMessage}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter 6 digits to auto-fill state, branch, and area from India Post data.
                                </p>
                            </div>

                            {postOffices.length > 1 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select area / post office
                                    </label>
                                    <select
                                        value={selectedOfficeIndex ?? 0}
                                        onChange={(e) =>
                                            handleOfficeSelect(Number(e.target.value))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                                    >
                                        {postOffices.map((office, index) => (
                                            <option key={`${office.name}-${index}`} value={index}>
                                                {office.name} — {office.district}, {office.state}
                                                {office.branchType ? ` (${office.branchType})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedOfficeIndex !== null && postOffices[selectedOfficeIndex] && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Delivery: {postOffices[selectedOfficeIndex].deliveryStatus || "—"}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Area Sales Location <span className="text-red-500">*</span>
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
                                        Branch Sales Location <span className="text-red-500">*</span>
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

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    disabled={submitting || pincodeLoading}
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
