"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Package, IndianRupee, Percent, Box, Share2, Info, Sparkles } from "lucide-react"
import axios from "axios"
import useSWR from "swr"
import UserNavbar from "../components/UserNavbar"
import { STORE_URL } from "@/lib/config"
import { fetcher } from "@/lib/fetcher"

interface Product {
    id: string
    title: string
    description: string
    thumbnail: string | null
    price: number
    category: string
    categories: string[]
    collection: string | null
    isInStock: boolean
    inventoryQuantity: number
    commissionRate: number | null
    commissionSource: string | null
    commissionAmount: number
    hasCommission: boolean
    status?: string
}

interface ProductsResponse {
    products?: Product[]
    allProducts?: Product[]
    categories?: string[]
}

const plainFetcher = (url: string) => axios.get(url).then(res => res.data)

export default function ProductsPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        const token = localStorage.getItem("affiliate_token")
        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")

        if (!token || !userData) {
            router.push("/login")
            return
        }

        if (role === "admin") {
            router.push("/admin/dashboard")
            return
        }

        try {
            const parsedUser = JSON.parse(userData)

            if (!parsedUser.is_approved) {
                router.push("/verification-pending")
                return
            }

            setUser(parsedUser)
            setAuthChecked(true)
        } catch (e) {
            console.error("Error parsing user data:", e)
            router.push("/login")
        }
    }, [router])

    // Live products feed.
    // Polls every 5s and revalidates on focus/reconnect, so admin status flips
    // (draft <-> published) and commission-list edits are reflected on the
    // page within a few seconds without a manual refresh.
    const {
        data: productsData,
        error: productsError,
        isLoading: productsLoading,
        isValidating: productsValidating,
    } = useSWR<ProductsResponse>(
        authChecked ? "/api/products" : null,
        fetcher,
        {
            refreshInterval: 5000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            revalidateOnMount: true,
            dedupingInterval: 1000,
            keepPreviousData: true,
        }
    )

    // Live affiliate commission rate
    const { data: ratesData } = useSWR(
        authChecked ? "/api/admin/commission-rates" : null,
        plainFetcher,
        {
            refreshInterval: 30000,
            revalidateOnFocus: true,
        }
    )

    // Live additional commissions (per product boosts)
    const { data: additionalData } = useSWR(
        authChecked ? "/api/additional-commissions/active?role=partner" : null,
        plainFetcher,
        {
            refreshInterval: 15000,
            revalidateOnFocus: true,
        }
    )

    // Real-time inventory feed.
    // This is a tiny, dedicated endpoint (a single SQL aggregate) so we can
    // poll it aggressively (every 3s) to reflect stock changes as sales happen
    // — without re-fetching the entire heavy product catalog.
    const { data: inventoryData } = useSWR<{
        success: boolean
        inventory: Record<string, number>
        updatedAt: string
    }>(
        authChecked ? "/api/products/inventory" : null,
        plainFetcher,
        {
            refreshInterval: 3000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 500,
            keepPreviousData: true,
        }
    )

    const liveInventory = inventoryData?.inventory || {}

    // Merge live inventory into the catalog so each card gets up-to-the-second
    // stock numbers. We fall back to the catalog's inventoryQuantity if the
    // live map doesn't contain the product (e.g. first paint before the
    // inventory poll resolves).
    const products = useMemo<Product[]>(() => {
        const list = productsData?.products || []
        if (!list.length) return list
        return list.map(p => {
            const live = liveInventory[p.id]
            if (live === undefined) return p
            return {
                ...p,
                inventoryQuantity: live,
                isInStock: live > 0,
            }
        })
    }, [productsData, liveInventory])

    const categories = productsData?.categories || []

    const affiliateRate = useMemo(() => {
        if (ratesData?.success && Array.isArray(ratesData.rates)) {
            const affiliateRateObj = ratesData.rates.find((r: any) => r.role_type === "affiliate")
            if (affiliateRateObj) {
                const value = parseFloat(affiliateRateObj.commission_percentage)
                if (!Number.isNaN(value)) return value
            }
        }
        return 100
    }, [ratesData])

    const additionalByProduct = useMemo(() => {
        const productRates: Record<string, number> = {}
        for (const row of additionalData?.campaigns || []) {
            const productId = String(row.product_id || "")
            const rate = Number(row.additional_rate || 0)
            if (!productId) continue
            if (!productRates[productId] || rate > productRates[productId]) {
                productRates[productId] = rate
            }
        }
        return productRates
    }, [additionalData])

    const error = productsError ? (productsError.message || "Failed to load products") : null
    // Show skeleton cards while the first request is in flight. Subsequent
    // renders show real data immediately (SWR keepPreviousData) and pulses the
    // Live indicator during background refreshes.
    const firstLoadInProgress = !productsData && productsLoading
    const showSkeleton = !authChecked || firstLoadInProgress

    // Filter products by status (published only), search and category
    const filteredProducts = products.filter(product => {
        const status = String(product.status ?? "published").toLowerCase()
        if (status !== "published") return false
        const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    const userName = user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name} `
        : user?.email

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
            <UserNavbar userName={userName} />

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-emerald-900 bg-clip-text text-transparent">
                            Product Catalog
                        </h1>
                        <Sparkles className="text-emerald-500 animate-pulse" size={24} />
                        <p className="text-gray-600 text-lg">Browse products and see your commission rates</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-3 py-2 rounded-full text-xs font-semibold shadow-sm"
                            title="Catalog updates automatically when admin publishes or unpublishes products"
                        >
                            <span className="relative flex h-2 w-2">
                                <span
                                    className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${productsValidating ? "animate-ping" : ""
                                        }`}
                                ></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Live
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur opacity-50"></div>
                            <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg">
                                {showSkeleton ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-4 w-12 bg-white/30 rounded animate-pulse"></span>
                                        Products
                                    </span>
                                ) : (
                                    `${filteredProducts.length} Products Available`
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col lg:flex-row gap-4 mb-10">
                    {/* Search Bar */}
                    <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-emerald-500 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md"
                            />
                        </div>
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setSelectedCategory("all")}
                            className={`px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${selectedCategory === "all"
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200"
                                : "bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 shadow-sm hover:shadow-md"
                                }`}
                        >
                            All Categories
                        </button>
                        {showSkeleton && categories.length === 0
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={`cat-skel-${i}`}
                                    className="h-11 w-24 rounded-full bg-white border-2 border-gray-100 shadow-sm animate-pulse"
                                />
                            ))
                            : categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${selectedCategory === category
                                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200"
                                        : "bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 shadow-sm hover:shadow-md"
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-8 shadow-sm">
                        {error}
                    </div>
                )}

                {/* Products Grid */}
                {showSkeleton ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                        <Package className="mx-auto text-gray-300 mb-4" size={64} />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-600 text-lg">
                            {searchQuery || selectedCategory !== "all"
                                ? "Try adjusting your search or filter criteria"
                                : "Products with commission will appear here once admin sets them up"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                user={user}
                                affiliateRate={affiliateRate}
                                additionalCommissionRate={additionalByProduct[product.id] || 0}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

function ProductCard({
    product,
    user,
    affiliateRate,
    additionalCommissionRate,
}: {
    product: Product
    user: any
    affiliateRate: number
    additionalCommissionRate: number
}) {
    const [copied, setCopied] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const [stockChanged, setStockChanged] = useState<"up" | "down" | null>(null)
    const prevStockRef = useRef<number>(product.inventoryQuantity)

    // Briefly highlight the inventory pill whenever the live value changes,
    // so the user can see stock decrement in real time as orders come in.
    useEffect(() => {
        const prev = prevStockRef.current
        const next = product.inventoryQuantity
        if (prev !== next) {
            setStockChanged(next < prev ? "down" : "up")
            prevStockRef.current = next
            const t = setTimeout(() => setStockChanged(null), 1200)
            return () => clearTimeout(t)
        }
    }, [product.inventoryQuantity])

    // Calculate actual commission after platform fee deduction
    const actualCommission = product.commissionAmount * (affiliateRate / 100)
    const platformFee = product.commissionAmount - actualCommission
    const additionalCommissionAmount = product.price * (additionalCommissionRate / 100)

    const handleShare = () => {
        const referralCode = user?.refer_code || ''
        // Generate slug from product title (lowercase, replace spaces with hyphens)
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        // Create shareable link matching the actual product URL format
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-teal-50/0 group-hover:from-emerald-50/50 group-hover:to-teal-50/30 transition-all duration-300 pointer-events-none"></div>

            {/* Share Button */}
            <button
                onClick={handleShare}
                className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md hover:bg-emerald-500 text-gray-700 hover:text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 hover:rotate-12"
                title="Share product with your referral link"
            >
                <Share2 size={18} />
            </button>

            {/* Copied notification */}
            {copied && (
                <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium px-4 py-2 rounded-full shadow-xl animate-bounce">
                    ✓ Link copied!
                </div>
            )}

            {/* Image Container */}
            <div className="relative h-56 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {product.thumbnail ? (
                    <img
                        src={product.thumbnail}
                        alt={product.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <Box className="text-gray-300 group-hover:text-emerald-300 transition-colors" size={80} />
                )}
            </div>

            {/* Content */}
            <div className="relative p-6 space-y-4">
                {/* Title and Stock Badge */}
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2 group-hover:text-emerald-900 transition-colors">
                        {product.title}
                    </h3>
                    <span className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap shadow-sm ${product.isInStock
                        ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                        : "bg-gradient-to-r from-red-400 to-pink-500 text-white"
                        }`}>
                        {product.isInStock ? "In Stock" : "Out of Stock"}
                    </span>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                    {product.description || "No description available"}
                </p>

                {/* Rating and Category */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-yellow-400 text-lg">★</span>
                        <span className="text-sm font-semibold text-gray-700">4.5</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gradient-to-r from-gray-100 to-slate-100 px-3 py-1.5 rounded-full border border-gray-200">
                        {product.category}
                    </span>
                </div>

                {/* Price and Commission Rate */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                        <IndianRupee size={18} className="text-gray-700" />
                        <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-emerald-900 bg-clip-text text-transparent">
                            {product.price.toLocaleString("en-IN")}
                        </span>
                    </div>
                    {product.commissionRate && (
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 rounded-full">
                            <Percent size={14} className="text-emerald-600" />
                            <span className="text-sm font-bold text-emerald-700">{product.commissionRate}%</span>
                        </div>
                    )}
                </div>

                {/* Live Inventory */}
                <div
                    className={`flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg border transition-colors duration-700 ${stockChanged === "down"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : stockChanged === "up"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : product.inventoryQuantity > 0
                                ? "bg-gray-50 border-gray-100 text-gray-600"
                                : "bg-red-50 border-red-200 text-red-600"
                        }`}
                    title="Stock updates in real time as sales happen"
                >
                    <div className="flex items-center gap-2">
                        <Box size={16} className="opacity-70" />
                        <span className="font-medium">
                            {product.inventoryQuantity > 0
                                ? `${product.inventoryQuantity} units available`
                                : "Out of stock"}
                        </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        Live
                    </span>
                </div>

                {/* Your Commission */}
                {product.commissionRate && (
                    <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-[2px] shadow-lg shadow-emerald-200">
                        <div className="bg-white rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-600">Your commission:</span>
                                    <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                        ₹{actualCommission.toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </span>
                                </div>
                                <div
                                    className="relative"
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => setShowTooltip(false)}
                                    onClick={() => setShowTooltip(!showTooltip)}
                                >
                                    <Info size={18} className="text-emerald-600 cursor-help hover:text-emerald-700 transition-colors" />
                                    {showTooltip && (
                                        <div className="absolute bottom-full right-0 mb-3 w-72 bg-gray-900 text-white text-xs rounded-xl p-4 shadow-2xl z-50">
                                            <div className="mb-3 font-bold text-sm">Commission Breakdown</div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between pb-2 border-b border-gray-700">
                                                    <span className="text-gray-300">Total Commission:</span>
                                                    <span className="font-semibold">₹{product.commissionAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-300">
                                                    <span>Your Share ({affiliateRate}%):</span>
                                                    <span className="font-bold">₹{actualCommission.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>Platform Fee ({(100 - affiliateRate).toFixed(0)}%):</span>
                                                    <span>₹{platformFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-3 h-3 bg-gray-900"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {additionalCommissionRate > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <div className="text-xs uppercase tracking-wide font-semibold text-emerald-700">Additional Commission</div>
                        <div className="text-sm font-semibold text-emerald-700 mt-1">
                            +{additionalCommissionRate}% (₹
                            {additionalCommissionAmount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}
                            )
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function ProductCardSkeleton() {
    return (
        <div className="relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden animate-pulse">
            {/* Image placeholder */}
            <div className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-50" />

            {/* Content placeholder */}
            <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-3/4 bg-gray-200 rounded" />
                        <div className="h-5 w-1/2 bg-gray-200 rounded" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                </div>

                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-100 rounded" />
                    <div className="h-3 w-5/6 bg-gray-100 rounded" />
                </div>

                <div className="flex items-center justify-between">
                    <div className="h-4 w-12 bg-gray-100 rounded" />
                    <div className="h-6 w-20 bg-gray-100 rounded-full" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="h-7 w-24 bg-gray-200 rounded" />
                    <div className="h-6 w-14 bg-gray-100 rounded-full" />
                </div>

                <div className="h-10 w-full bg-gray-100 rounded-lg" />
                <div className="h-12 w-full bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl" />
            </div>
        </div>
    )
}
