"use client"

import { useEffect, useState } from "react"
import { Search, Package, IndianRupee, Percent, Box, Share2, X, Star, ArrowUp, ArrowDown } from "lucide-react"
import axios from "axios"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { STORE_URL } from "@/lib/config"
import { useTheme } from "@/contexts/ThemeContext"

interface User {
    refer_code?: string
    name?: string
    email?: string
}

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
}

export default function BranchProductsPage() {
    const { theme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)

    const [commissionRate, setCommissionRate] = useState<number>(0)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        const token = localStorage.getItem("affiliate_token")
        if (userData) {
            try {
                const parsed = JSON.parse(userData) as User
                setUser(parsed)
            } catch (parseError) {
                console.error("Failed to parse affiliate_user from localStorage:", parseError)
                setUser(null)
            }
        }
        if (token) {
            fetchProducts(token)
            fetchCommissionRates()
        } else {
            setLoading(false)
            setError("Not authenticated")
        }
    }, [])

    const fetchCommissionRates = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success && response.data.rates) {
                const rates = response.data.rates as { role_type: string; commission_percentage: string }[];
                const affiliateRateObj = rates.find((r) => r.role_type === "affiliate")
                const branchDirectRateObj = rates.find((r) => r.role_type === "branch")

                const baseRate = parseFloat(affiliateRateObj?.commission_percentage || '70')
                const bonusRate = parseFloat(branchDirectRateObj?.commission_percentage || '15')

                setCommissionRate(baseRate + bonusRate)
            }
        } catch (err) {
            console.error("Error fetching commission rates:", err)
            // Default fallback
            setCommissionRate(85)
        }
    }

    const fetchProducts = async (token: string) => {
        try {
            const response = await axios.get("/api/products", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            })

            const data = response.data
            setProducts(data.products || data.allProducts || [])
            setCategories(data.categories || [])
        } catch (err: unknown) {
            const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
            console.error("Error fetching products:", err)
            setError(errorObj.response?.data?.message || errorObj.message || "Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    // Filter products by search and category
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Loading products...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 min-h-screen bg-gradient-to-br  to-emerald-50 md:bg-none">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Product Catalog</h1>
                    <p className="text-gray-600 text-[10px] md:text-base mt-1 md:mt-2">Browse products and see affiliate commission rates</p>
                </div>
                <div className="hidden md:block px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
                    {filteredProducts.length} Products Available
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                {/* Search Bar */}
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 md:py-4 border-2 border-gray-100 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white shadow-sm hover:shadow-md text-sm md:text-base"
                    />
                </div>

                {/* Category Filters */}
                <div className="flex flex-col gap-3">
                    <div className="flex overflow-x-auto pb-2 -mx-2 px-2 md:p-0 md:mx-0 md:flex-wrap md:overflow-visible gap-2 no-scrollbar">
                        <button
                            onClick={() => setSelectedCategory("all")}
                            className={`whitespace-nowrap px-4 md:px-5 py-2.5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${selectedCategory === "all"
                                ? "text-white shadow-lg"
                                : "bg-white border-2 border-gray-100 text-gray-600 hover:border-orange-200"
                                }`}
                            style={selectedCategory === "all" ? { backgroundColor: theme.primary } : {}}
                        >
                            All Categories
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`whitespace-nowrap px-4 md:px-5 py-2.5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${selectedCategory === category
                                    ? "text-white shadow-lg"
                                    : "bg-white border-2 border-gray-100 text-gray-600 hover:border-orange-200"
                                    }`}
                                style={selectedCategory === category ? { backgroundColor: theme.primary } : {}}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <div className="md:hidden self-start text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border shadow-sm" style={{ backgroundColor: theme.primaryLight, color: theme.primary, borderColor: `${theme.primary}33` }}>
                        {filteredProducts.length} Products Available
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
                    <Package className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                    <p className="text-gray-600">
                        {searchQuery || selectedCategory !== "all"
                            ? "Try adjusting your search or filter criteria"
                            : "Products with commission will appear here once admin sets them up"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {filteredProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            user={user}
                            theme={theme}
                            commissionRate={commissionRate}
                            onMobileClick={() => setSelectedProduct(product)}
                        />
                    ))}
                </div>
            )}

            <AnimatePresence>
                {selectedProduct && (
                    <ProductDetailModal
                        product={selectedProduct}
                        user={user}
                        commissionRate={commissionRate}
                        theme={theme}
                        onClose={() => setSelectedProduct(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function ProductDetailModal({
    product,
    user,
    commissionRate,
    theme,
    onClose
}: {
    product: Product
    user: User | null
    commissionRate: number
    theme: { primary: string; primaryLight: string }
    onClose: () => void
}) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const actualCommission = commissionRate > 0
        ? product.commissionAmount * (commissionRate / 100)
        : product.commissionAmount * 0.85

    useEffect(() => {
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = "auto"
        }
    }, [])

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!STORE_URL) {
            console.error("STORE_URL is not configured")
            return
        }
        const referralCode = user?.refer_code || ""
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: `Check out this product: ${product.title}`,
                    url: shareLink,
                })
            } catch {
                // no-op
            }
        } else {
            navigator.clipboard.writeText(shareLink)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-0 overflow-y-auto overflow-x-hidden md:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full bg-white min-h-[101vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 left-0 right-0 z-50 flex justify-between p-4 pointer-events-none">
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg text-gray-700 pointer-events-auto active:scale-95"
                    >
                        <X size={18} />
                    </button>

                    <button
                        onClick={handleShare}
                        className="p-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg text-gray-700 pointer-events-auto active:scale-95"
                        title="Share Referral Link"
                    >
                        <Share2 size={18} />
                    </button>
                </div>

                <div className="relative -mt-14 h-[50vh] bg-gray-50 flex items-center justify-center p-12 shrink-0">
                    {product.thumbnail ? (
                        <Image
                            src={product.thumbnail}
                            alt={product.title}
                            fill
                            className="object-contain drop-shadow-xl"
                            unoptimized
                        />
                    ) : (
                        <Box size={80} className="text-gray-200" />
                    )}
                </div>

                <div className="px-6 py-8 space-y-7 bg-white rounded-t-[32px] -mt-8 relative z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2 py-0.5 text-[9px] font-bold rounded-md border tracking-wider uppercase ${product.isInStock ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                                {product.isInStock ? "In Stock" : "Out of Stock"}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-md border border-yellow-100">
                                <Star size={10} className="fill-yellow-500 text-yellow-500" />
                                <span className="text-[9px] font-bold uppercase">4.5 Rating</span>
                            </div>
                            <div className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 text-[9px] font-bold uppercase tracking-wider">
                                {product.inventoryQuantity} Units Available
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{product.title}</h2>
                    </div>

                    <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="grid grid-cols-2 gap-6 relative z-10">
                            <div className="space-y-0.5">
                                <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest opacity-60">Listing Price</span>
                                <div className="flex items-center gap-0.5">
                                    <IndianRupee size={16} className="text-gray-400" />
                                    <span className="text-xl font-bold">{product.price.toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                            <div className="space-y-0.5 text-right">
                                <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest opacity-60">Commission</span>
                                <div className="flex items-center justify-end gap-1">
                                    <span className="text-xl font-bold text-emerald-400">
                                        {product.commissionRate !== null ? `${product.commissionRate}%` : "N/A"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between relative z-10">
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Potential Earn</span>
                                <p className="text-[8px] text-gray-500 font-medium uppercase tracking-tighter">Gross margin estimate</p>
                            </div>
                            <div className="flex items-baseline gap-0.5 text-emerald-400">
                                <span className="text-xs font-bold">₹</span>
                                <span className="text-3xl font-bold">{actualCommission.toLocaleString("en-IN")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Description</h3>
                            <div className="h-[1px] flex-1 bg-gray-50 ml-4"></div>
                        </div>
                        <div>
                            <p className={`text-gray-600 text-[13px] leading-relaxed transition-all duration-300 ${!isDescriptionExpanded && "line-clamp-4"}`}>
                                {product.description || "No description available"}
                            </p>
                            {(product.description?.length || 0) > 150 && (
                                <button
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                    className="mt-3 text-[10px] font-bold flex items-center gap-1 transition-colors uppercase tracking-widest"
                                    style={{ color: theme.primary }}
                                >
                                    {isDescriptionExpanded ? (
                                        <>Show Less <ArrowUp size={10} /></>
                                    ) : (
                                        <>Read Full Description <ArrowDown size={10} /></>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="pb-12">
                        <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                            <Package size={14} style={{ color: theme.primary }} />
                            <div>
                                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Category</p>
                                <p className="text-[11px] font-semibold text-gray-900 leading-none">{product.category}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

function ProductCard({
    product,
    user,
    theme,
    commissionRate,
    onMobileClick
}: {
    product: Product
    user: User | null
    theme: { primary: string; primaryLight: string }
    commissionRate: number
    onMobileClick: () => void
}) {
    const [copied, setCopied] = useState(false)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

    // Calculate actual commission based on the rate (e.g. 85%)
    // If commissionRate is not yet loaded (0), show loading or fallback
    const actualCommission = commissionRate > 0
        ? product.commissionAmount * (commissionRate / 100)
        : product.commissionAmount * 0.85 // Fallback to 85% estimate while loading

    const handleShare = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        if (!STORE_URL) {
            console.error("STORE_URL is not configured")
            return
        }
        const referralCode = user?.refer_code || ''
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div
            onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                    onMobileClick()
                }
            }}
            className="group relative bg-white rounded-2xl md:rounded-xl border-2 md:border border-gray-100 overflow-hidden transition-all duration-300 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1 cursor-pointer md:cursor-default"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-teal-50/0 group-hover:from-emerald-50/50 group-hover:to-teal-50/30 transition-all duration-300 pointer-events-none"></div>

            {/* Share Button */}
            <button
                onClick={handleShare}
                className="absolute top-2 right-2 md:top-3 md:right-3 z-10 bg-white/90 backdrop-blur-md hover:bg-emerald-500 text-gray-700 hover:text-white p-1.5 md:p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
                title="Share product with referral link"
            >
                <Share2 size={14} className="md:w-[18px] md:h-[18px]" />
            </button>

            {/* Copied notification */}
            {copied && (
                <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] md:text-xs font-medium px-2 md:px-3 py-1 md:py-1.5 rounded-full shadow-xl animate-pulse">
                    Link copied!
                </div>
            )}

            {/* Image */}
            <div className="relative h-32 md:h-48 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-3 md:p-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {product.thumbnail ? (
                    <div className="relative w-full h-full">
                        <Image
                            src={product.thumbnail}
                            alt={product.title}
                            fill
                            className="object-contain transform group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                        />
                    </div>
                ) : (
                    <Box className="text-gray-300 group-hover:text-emerald-300 transition-colors w-10 h-10 md:w-16 md:h-16" />
                )}
            </div>

            {/* Content */}
            <div className="relative p-4 md:p-5 space-y-3 md:space-y-4">
                {/* Title and Stock Badge */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-bold text-gray-900 text-sm md:text-lg leading-tight line-clamp-1 md:line-clamp-2 group-hover:text-emerald-900 transition-colors">
                        {product.title}
                    </h3>

                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-yellow-400 text-sm md:text-base">*</span>
                            <span className="text-[10px] md:text-sm font-bold text-gray-700">4.5</span>
                        </div>
                        <span
                            className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-full whitespace-nowrap shadow-sm ${product.isInStock
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-red-50 text-red-700 border border-red-100"
                                }`}
                        >
                            {product.isInStock ? "In Stock" : "Out of Stock"}
                        </span>
                    </div>
                </div>

                {/* Description */}
                <div className="hidden md:block">
                    <p className={`text-gray-600 text-sm ${isDescriptionExpanded ? "" : "line-clamp-2"}`}>
                        {product.description || "No description available"}
                    </p>
                    {product.description && product.description.length > 90 && (
                        <button
                            onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                            className="mt-1 text-xs font-semibold hover:underline"
                            style={{ color: theme.primary }}
                        >
                            {isDescriptionExpanded ? "Show less" : "Read more"}
                        </button>
                    )}
                </div>

                {/* Category */}
                <div className="hidden md:block">
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {product.category}
                    </span>
                </div>

                {/* Price and Commission */}
                <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                        <IndianRupee size={12} className="md:w-4 md:h-4 text-gray-900" />
                        <span className="text-sm md:text-xl font-bold text-gray-900">
                            {product.price.toLocaleString("en-IN")}
                        </span>
                    </div>
                    {product.commissionRate && (
                        <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                            <Percent size={10} className="md:w-3.5 md:h-3.5" style={{ color: theme.primary }} />
                            <span className="text-[10px] md:text-sm font-bold" style={{ color: theme.primary }}>
                                {product.commissionRate}%
                            </span>
                        </div>
                    )}
                </div>

                {/* Inventory */}
                {product.inventoryQuantity > 0 && (
                    <div className="hidden md:flex items-center gap-1 text-gray-500 text-sm">
                        <Box size={14} />
                        <span>{product.inventoryQuantity} units available</span>
                    </div>
                )}

                {/* Affiliate Commission */}
                {product.commissionRate && (
                    <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg p-[1px] shadow-sm">
                        <div className="rounded-[7px] px-2 md:px-3 py-1.5 md:py-2 space-y-1" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.primary}20` }}>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] md:text-xs font-medium text-gray-600">Your Share ({commissionRate}%):</span>
                                <span className="font-bold text-xs md:text-lg" style={{ color: theme.primary }}>
                                    {"\u20B9"}{actualCommission.toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] md:text-xs text-gray-500 border-t border-gray-200 pt-1 mt-1">
                                <span>Total Commission:</span>
                                <span>{"\u20B9"}{product.commissionAmount.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}



