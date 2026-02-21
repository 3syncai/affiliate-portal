"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Package, IndianRupee, Percent, Box, Share2, Info, X, Star, ArrowUp, ArrowDown } from "lucide-react"
import axios from "axios"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import UserNavbar from "../components/UserNavbar"
import { BACKEND_URL, STORE_URL } from "@/lib/config"

interface User {
    id: string
    first_name: string
    last_name: string
    email: string
    refer_code: string
    is_approved: boolean
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

export default function ProductsPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [affiliateRate, setAffiliateRate] = useState<number>(100) // Default 100% if not set

    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem("affiliate_token")
        const userData = localStorage.getItem("affiliate_user")
        const role = localStorage.getItem("affiliate_role")

        if (!token || !userData) {
            router.push("/login")
            return
        }

        // If admin, redirect to admin dashboard
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
            fetchProducts(token)
            fetchAffiliateRate()
        } catch (e) {
            console.error("Error parsing user data:", e)
            router.push("/login")
        }
    }, [router])

    const fetchAffiliateRate = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success && response.data.rates) {
                const affiliateRateObj = response.data.rates.find(
                    (r: { role_type: string, commission_percentage: string }) => r.role_type === "affiliate"
                )
                if (affiliateRateObj) {
                    setAffiliateRate(parseFloat(affiliateRateObj.commission_percentage))
                }
            }
        } catch (err) {
            console.error("Error fetching affiliate rate:", err)
            // Keep default 100% if fetch fails
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
            setProducts(data.products || [])
            setCategories(data.categories || [])
        } catch (err: unknown) {
            const error = err as Error & { response?: { data?: { message?: string } } };
            console.error("Error fetching products:", error)
            setError(error.response?.data?.message || error.message || "Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    // Filter products by search and category
    const filteredProducts = products.filter(product => {
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

            {loading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-600 font-medium">Loading products...</span>
                    </div>
                </div>
            ) : (
                <main className="max-w-7xl mx-auto pt-4 md:pt-8 pb-12 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-8 md:mb-12">
                        <div>
                            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-emerald-900 bg-clip-text text-transparent">
                                Product Catalog
                            </h1>
                            <p className="text-gray-600 text-[10px] md:text-lg mt-1 md:mt-2">Browse products and see your commission rates</p>
                        </div>

                        <div className="relative hidden md:block">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur opacity-30"></div>
                            <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3.5 rounded-full text-sm font-semibold shadow-lg">
                                {filteredProducts.length} Products Available
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters - Integrated for Desktop, Stacked for Mobile */}
                    <div className="flex flex-col lg:flex-row gap-6 mb-8 md:mb-12">
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-hover:opacity-10 transition-opacity"></div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-emerald-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 md:py-4 border-2 border-gray-100 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md text-sm md:text-base"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Category Filters - Scrollable on mobile, Fixed row on desktop */}
                            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 lg:p-0 lg:mx-0 lg:overflow-visible gap-2 md:gap-3 no-scrollbar">
                                <button
                                    onClick={() => setSelectedCategory("all")}
                                    className={`whitespace-nowrap px-5 md:px-6 py-2.5 md:py-3.5 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${selectedCategory === "all"
                                        ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-xl"
                                        : "bg-white border-2 border-gray-100 text-gray-600 hover:border-emerald-200"
                                        }`}
                                >
                                    All Products
                                </button>
                                {categories.map((category) => (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`whitespace-nowrap px-5 md:px-6 py-2.5 md:py-3.5 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${selectedCategory === category
                                            ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-xl"
                                            : "bg-white border-2 border-gray-100 text-gray-600 hover:border-emerald-200"
                                            }`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>

                            {/* Mobile-only badge */}
                            <div className="md:hidden self-start text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100 shadow-sm">
                                {filteredProducts.length} Products Available
                            </div>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-8 shadow-sm">
                            {error}
                        </div>
                    )}

                    {/* Products Grid */}
                    {filteredProducts.length === 0 ? (
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
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-10">
                            {filteredProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    user={user}
                                    affiliateRate={affiliateRate}
                                    onMobileClick={() => setSelectedProduct(product)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            )}

            <AnimatePresence>
                {selectedProduct && (
                    <ProductDetailModal
                        product={selectedProduct}
                        user={user}
                        affiliateRate={affiliateRate}
                        onClose={() => setSelectedProduct(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function ProductDetailModal({ product, user, affiliateRate, onClose }: { product: Product; user: User | null; affiliateRate: number; onClose: () => void }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const actualCommission = product.commissionAmount * (affiliateRate / 100)

    // Prevent scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'auto'
        }
    }, [])

    // Native Web Share API
    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!STORE_URL) {
            console.error("STORE_URL is not configured")
            return
        }
        const referralCode = user?.refer_code || ''
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: `Check out this product: ${product.title}`,
                    url: shareLink,
                })
            } catch (err) {
                // User cancelled or share failed - no alert as per preference
                console.log('Share failed:', err)
            }
        } else {
            // Fallback to clipboard without alert
            navigator.clipboard.writeText(shareLink)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 overflow-y-auto overflow-x-hidden touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-xl bg-white sm:rounded-3xl shadow-2xl min-h-[101vh] sm:min-h-0 sm:h-auto sm:max-h-[90vh] sm:my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Floating sticky controls at the very top of the SCROLL CONTAINER */}
                <div className="sticky top-0 left-0 right-0 z-50 flex justify-between p-4 pointer-events-none">
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg text-gray-700 hover:text-red-500 transition-all pointer-events-auto active:scale-95"
                    >
                        <X size={18} />
                    </button>

                    <button
                        onClick={handleShare}
                        className="p-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg text-gray-700 hover:text-emerald-600 transition-all pointer-events-auto active:scale-95"
                        title="Share Referral Link"
                    >
                        <Share2 size={18} />
                    </button>
                </div>

                {/* Hero Image Section - 50vh height purely for mobile impact */}
                <div className="relative -mt-14 h-[50vh] sm:h-80 bg-gray-50 flex items-center justify-center p-12 shrink-0">
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

                {/* Content Section */}
                <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-7 bg-white rounded-t-[32px] -mt-8 relative z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
                    {/* Badge & Title */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2 py-0.5 text-[9px] font-bold rounded-md border tracking-wider uppercase ${product.isInStock ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {product.isInStock ? 'In Stock' : 'Out of Stock'}
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

                    {/* Premium Price & Earn Display */}
                    <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

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
                                    <span className="text-xl font-bold text-emerald-400">{product.commissionRate}%</span>
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

                    {/* Description - Built for readability */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Description</h3>
                            <div className="h-[1px] flex-1 bg-gray-50 ml-4"></div>
                        </div>
                        <div className="relative">
                            <p className={`text-gray-600 text-[13px] leading-relaxed transition-all duration-300 ${!isDescriptionExpanded && 'line-clamp-4'}`}>
                                {product.description || "Premium product crafted with excellence. Includes high-grade materials and industry-standard quality assurance for customer satisfaction."}
                            </p>
                            {(product.description?.length || 150) > 150 && (
                                <button
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                    className="mt-3 text-emerald-600 text-[10px] font-bold flex items-center gap-1 hover:text-emerald-700 transition-colors uppercase tracking-widest active:scale-95"
                                >
                                    {isDescriptionExpanded ? (
                                        <>Show Less <ArrowUp size={10} /></>
                                    ) : (
                                        <>Read Full Description<ArrowDown size={10} /></>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Specifications Cards */}
                    <div className="pb-12">
                        <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                            <Package size={14} className="text-emerald-500" />
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

function ProductCard({ product, user, affiliateRate, onMobileClick }: { product: Product; user: User | null; affiliateRate: number; onMobileClick: () => void }) {
    const [copied, setCopied] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    // Calculate actual commission after platform fee deduction
    const actualCommission = product.commissionAmount * (affiliateRate / 100)

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!STORE_URL) {
            console.error("STORE_URL is not configured")
            return
        }
        const referralCode = user?.refer_code || ''
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.title,
                    text: `Check out this product: ${product.title}`,
                    url: shareLink,
                })
            } catch (err) {
                console.log('Share failed:', err)
            }
        } else {
            // Fallback for desktop/unsupported browsers
            navigator.clipboard.writeText(shareLink).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            })
        }
    }

    return (
        <div
            onClick={() => {
                if (window.innerWidth < 768) {
                    onMobileClick()
                }
            }}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1 cursor-pointer md:cursor-default"
        >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-teal-50/0 group-hover:from-emerald-50/50 group-hover:to-teal-50/30 transition-all duration-300 pointer-events-none"></div>

            {/* Share Button */}
            <button
                onClick={handleShare}
                className="absolute top-2 right-2 md:top-4 md:right-4 z-10 bg-white/90 backdrop-blur-md hover:bg-emerald-500 text-gray-700 hover:text-white p-2 md:p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110"
                title="Share product with your referral link"
            >
                <Share2 size={16} className="md:w-4.5 md:h-4.5" />
            </button>

            {/* Copied notification */}
            {copied && (
                <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] md:text-sm font-medium px-2 md:px-4 py-1 md:py-2 rounded-full shadow-xl animate-bounce">
                    ✓ Copied!
                </div>
            )}

            {/* Image Container */}
            <div className="relative h-32 md:h-56 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-3 md:p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {product.thumbnail ? (
                    <Image
                        src={product.thumbnail}
                        alt={product.title}
                        fill
                        className="object-contain transform group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                    />
                ) : (
                    <Box className="text-gray-300 group-hover:text-emerald-300 transition-colors w-10 h-10 md:w-20 md:h-20" />
                )}
            </div>

            {/* Content */}
            <div className="relative p-4 md:p-8 space-y-4 md:space-y-6">
                {/* Title and Stock Badge */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900 text-sm md:text-xl leading-tight line-clamp-1 md:line-clamp-2 group-hover:text-emerald-900 transition-colors">
                            {product.title}
                        </h3>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-yellow-400 text-sm md:text-xl">★</span>
                            <span className="text-[10px] md:text-base font-bold text-gray-700">4.5</span>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-full whitespace-nowrap shadow-sm ${product.isInStock
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                            }`}>
                            {product.isInStock ? "In Stock" : "Out of Stock"}
                        </span>
                    </div>
                </div>

                {/* Description - Desktop only */}
                <div className="hidden md:block">
                    <p className={`text-gray-500 text-sm leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                        {product.description || "No description available"}
                    </p>
                    {product.description && product.description.length > 80 && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-emerald-600 text-xs font-bold mt-1 hover:text-emerald-700 transition-colors focus:outline-none"
                        >
                            {isExpanded ? "Show less" : "Read more"}
                        </button>
                    )}
                </div>

                {/* Category - Desktop only */}
                <div className="hidden md:block">
                    <span className="text-xs font-medium text-gray-500 bg-gradient-to-r from-gray-100 to-slate-100 px-3 py-1.5 rounded-full border border-gray-200">
                        {product.category}
                    </span>
                </div>

                {/* Price and Commission Rate */}
                <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                        <IndianRupee size={12} className="md:w-5 md:h-5 text-gray-900" />
                        <span className="text-sm md:text-3xl font-black text-gray-900">
                            {product.price.toLocaleString("en-IN")}
                        </span>
                    </div>
                    {product.commissionRate && (
                        <div className="flex items-center gap-1 bg-emerald-50 px-2 md:px-4 py-1 md:py-2 rounded-full border border-emerald-100">
                            <Percent size={10} className="md:w-4 md:h-4 text-emerald-600" />
                            <span className="text-[10px] md:text-base font-black text-emerald-700">{product.commissionRate}%</span>
                        </div>
                    )}
                </div>

                {/* Inventory */}
                {product.inventoryQuantity > 0 && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 px-3 py-2 rounded-lg">
                        <Box size={16} className="text-gray-400" />
                        <span className="font-medium">{product.inventoryQuantity} units available</span>
                    </div>
                )}

                {/* Your Commission */}
                {product.commissionRate && (
                    <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg md:rounded-xl p-[1px] md:p-[2px] shadow-sm md:shadow-lg">
                        <div className="bg-white rounded-[7px] md:rounded-xl px-2 md:px-4 py-1.5 md:py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 md:gap-2">
                                    <span className="text-[10px] md:text-sm font-medium text-gray-500">Earn:</span>
                                    <span className="text-xs md:text-lg font-bold text-emerald-600">
                                        ₹{actualCommission.toLocaleString("en-IN")}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 -mr-2 text-gray-400 hover:text-emerald-500 transition-colors focus:outline-none"
                                    onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip) }}
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => setShowTooltip(false)}
                                    aria-label="Commission breakdown"
                                >
                                    <Info size={14} className="md:w-5 md:h-5" />
                                    {showTooltip && (
                                        <div className="absolute bottom-full right-0 mb-3 w-48 md:w-72 bg-gray-900 text-white text-[10px] md:text-xs rounded-lg md:rounded-xl p-3 md:p-4 shadow-2xl z-50 pointer-events-none">
                                            <div className="mb-2 font-bold text-xs md:text-sm text-emerald-400">Breakdown</div>
                                            <div className="space-y-1.5 md:space-y-2">
                                                <div className="flex justify-between pb-1.5 border-b border-gray-700">
                                                    <span className="text-gray-400">Total:</span>
                                                    <span>₹{product.commissionAmount.toFixed(0)}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-300 font-bold">
                                                    <span>You Earn:</span>
                                                    <span>₹{actualCommission.toFixed(0)}</span>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 right-3 md:right-5 transform translate-y-1/2 rotate-45 w-2 md:w-3 h-2 md:h-3 bg-gray-900"></div>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
