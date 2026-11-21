"use client"

import { useEffect, useState } from "react"
import { Search, Filter, Package, TrendingUp, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react"
import axios from "axios"

type Product = {
  id: string
  title: string
  handle: string
  status: string
  description?: string
  thumbnail?: string
  images: any[]
  categories: Array<{ id: string; name: string; handle: string; commission: number }>
  collection: { id: string; title: string; handle: string; commission: number } | null
  tags: Array<{ id: string; value: string }>
  type: { id: string; value: string } | null
  variants: Array<{
    id: string
    title: string
    sku?: string
    inventory_quantity: number
    price: number
    original_price?: number
  }>
  total_inventory: number
  in_stock: boolean
  commission: number
  created_at: string
  updated_at: string
}

type AdditionalCampaign = {
  id: number
  product_id: string
  product_name: string | null
  additional_rate: number
  target_role: string
  starts_at: string
  ends_at: string | null
  is_active: boolean
  runtime_status: "ACTIVE" | "UPCOMING" | "ENDED" | "INACTIVE"
}

const roleLabels: Record<string, string> = {
  partner: "Sales Executive",
  asm: "Area Sales Manager",
  branch: "Branch Admin",
  state: "State Admin",
  all: "All",
}

type Filters = {
  categories: Array<{ id: string; name: string; handle: string; commission: number }>
  collections: Array<{ id: string; title: string; handle: string; commission: number }>
  types: Array<{ id: string; value: string }>
}

const PAGE_SIZE = 25

export default function ProductCommissionPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filters, setFilters] = useState<Filters>({ categories: [], collections: [], types: [] })
  const [stats, setStats] = useState({ total: 0, in_stock: 0, out_of_stock: 0 })
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedCollection, setSelectedCollection] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [stockFilter, setStockFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [additionalCampaigns, setAdditionalCampaigns] = useState<AdditionalCampaign[]>([])

  // Debounce typing and jump back to page 1 when the search term changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Additional-commission campaigns are small; load them once.
  useEffect(() => {
    axios
      .get("/api/admin/additional-commissions")
      .then((res) => setAdditionalCampaigns(res.data?.campaigns || []))
      .catch((error) => console.error("Failed to fetch campaigns:", error))
  }, [])

  // Fetch one page at a time; search/filters are applied on the server.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setFetching(true)
      try {
        const res = await axios.get("/api/affiliate/admin/products", {
          params: {
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch,
            category: selectedCategory,
            collection: selectedCollection,
            type: selectedType,
            stock: stockFilter,
          },
        })
        if (cancelled) return
        const data = res.data
        setProducts(data.products || [])
        setFilters(data.filters || { categories: [], collections: [], types: [] })
        setStats(data.stats || { total: 0, in_stock: 0, out_of_stock: 0 })
        setTotal(data.pagination?.total ?? 0)
        setTotalPages(data.pagination?.totalPages ?? 1)
      } catch (error: any) {
        if (cancelled) return
        console.error("Failed to fetch products:", error)
        const errorMessage = error.response?.data?.message || error.message || "Unknown error"
        alert(`Error loading products: ${errorMessage}`)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setFetching(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, selectedCategory, selectedCollection, selectedType, stockFilter])

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const changeFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const filteredProducts = products
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const formatCurrency = (amount: number) => {
    // Backend returns price directly, no division needed
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading products...</div>
      </div>
    )
  }

  const renderAdditionalCommission = (product: Product) => {
    const active = additionalCampaigns.filter(
      (c) => c.product_id === product.id && c.runtime_status === "ACTIVE"
    )
    const upcoming = additionalCampaigns.filter(
      (c) => c.product_id === product.id && c.runtime_status === "UPCOMING"
    )
    if (active.length === 0 && upcoming.length === 0) {
      return <span className="text-xs text-gray-400">—</span>
    }
    return (
      <div className="space-y-1">
        {active.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-700">+{c.additional_rate}%</span>
            <span className="text-xs text-gray-500">({roleLabels[c.target_role] ?? c.target_role})</span>
          </div>
        ))}
        {upcoming.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-blue-600">+{c.additional_rate}%</span>
            <span className="text-xs text-gray-400">(upcoming · {roleLabels[c.target_role] ?? c.target_role})</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Commission</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage commission settings for products, categories, and brands</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Products</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">In Stock</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1 sm:mt-2">{stats.in_stock}</p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-lg shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Out of Stock</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1 sm:mt-2">{stats.out_of_stock}</p>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-lg shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Filtered Results</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1 sm:mt-2">{total}</p>
            </div>
            <div className="bg-indigo-100 p-2 sm:p-3 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters — stacked on mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 relative z-10">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="w-full relative z-10">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-gray-700"
          >
            <Filter className="w-5 h-5 mr-2 text-gray-500" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200 relative z-10 bg-white">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => changeFilter(setSelectedCategory)(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {filters.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
              <select
                value={selectedCollection}
                onChange={(e) => changeFilter(setSelectedCollection)(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
              >
                <option value="all">All Brands</option>
                {filters.collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Category</label>
              <select
                value={selectedType}
                onChange={(e) => changeFilter(setSelectedType)(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
              >
                <option value="all">All Sub-Categories</option>
                {filters.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
              <select
                value={stockFilter}
                onChange={(e) => changeFilter(setStockFilter)(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 appearance-none cursor-pointer"
              >
                <option value="all">All Products</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center text-gray-500">
          No products found
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${fetching ? "opacity-60" : ""}`}>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0"
              >
                <div className="flex items-start gap-3 mb-3">
                  {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.thumbnail}
                      alt={product.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{product.title}</p>
                        <p className="text-xs text-gray-500 truncate">SKU: {product.variants[0]?.sku || "N/A"}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          product.in_stock ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {product.in_stock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Category</p>
                    {product.categories.length > 0 ? (
                      <div className="space-y-0.5">
                        {product.categories.map((cat) => (
                          <p key={cat.id} className="truncate">
                            {cat.name}
                            {cat.commission > 0 ? ` (${cat.commission}%)` : ""}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400">No category</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Brand</p>
                    {product.collection ? (
                      <p className="truncate">
                        {product.collection.title}
                        {product.collection.commission > 0 ? ` (${product.collection.commission}%)` : ""}
                      </p>
                    ) : (
                      <p className="text-gray-400">No brand</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Inventory</p>
                    <p className={`font-medium ${product.in_stock ? "text-green-600" : "text-red-600"}`}>
                      {product.total_inventory} units
                    </p>
                    <p className="text-gray-500">
                      {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">Commission</p>
                    <p className="font-medium text-indigo-600">
                      {product.commission > 0 ? `${product.commission}%` : "Not set"}
                    </p>
                    {product.variants[0]?.price != null && (
                      <p className="text-gray-500 truncate">{formatCurrency(product.variants[0].price)}</p>
                    )}
                  </div>
                  <div className="min-w-0 col-span-2">
                    <p className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold mb-1">
                      Additional Commission
                    </p>
                    {renderAdditionalCommission(product)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Inventory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Additional Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {product.thumbnail && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.thumbnail}
                              alt={product.title}
                              className="w-12 h-12 rounded-lg object-cover mr-3"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.title}</div>
                            <div className="text-xs text-gray-500">SKU: {product.variants[0]?.sku || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.categories.length > 0 ? (
                            <div className="space-y-1">
                              {product.categories.map((cat) => (
                                <div key={cat.id} className="flex items-center">
                                  <span>{cat.name}</span>
                                  {cat.commission > 0 && (
                                    <span className="ml-2 text-xs text-green-600">
                                      ({cat.commission}%)
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">No category</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.collection ? (
                            <div>
                              <div>{product.collection.title}</div>
                              {product.collection.commission > 0 && (
                                <div className="text-xs text-green-600">
                                  Commission: {product.collection.commission}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No brand</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className={`font-medium ${product.in_stock ? "text-green-600" : "text-red-600"}`}>
                            {product.total_inventory} units
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-indigo-600">
                            {product.commission > 0 ? `${product.commission}%` : "Not set"}
                          </div>
                          {product.variants[0]?.price && (
                            <div className="text-xs text-gray-500">
                              Price: {formatCurrency(product.variants[0].price)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {renderAdditionalCommission(product)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.in_stock
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs sm:text-sm text-gray-600">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            {totalPages > 1 && (
              <nav className="flex w-full sm:w-auto items-center justify-center gap-2" aria-label="Product pages">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 sm:px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <span className="flex-1 sm:flex-none sm:min-w-[110px] text-center text-sm text-gray-600 tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 sm:px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

