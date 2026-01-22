"use client"

import { useEffect, useState } from "react"
import { Search, Package, IndianRupee, Percent, Box, Share2, Info, Sparkles } from "lucide-react"
import axios from "axios"
import { BACKEND_URL, STORE_URL } from "@/lib/config"

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

export default function ProductsView() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [affiliateRate, setAffiliateRate] = useState<number>(100)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        const token = localStorage.getItem("affiliate_token")

        if (userData) {
            try {
                const parsedUser = JSON.parse(userData)
                setUser(parsedUser)
            } catch (e) {
                console.error("Error parsing user data:", e)
            }
        }

        if (token) {
            fetchProducts(token)
            fetchAffiliateRate()
        } else {
            setLoading(false)
            setError("Not authenticated")
        }
    }, [])

    const fetchAffiliateRate = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success && response.data.rates) {
                const affiliateRateObj = response.data.rates.find(
                    (r: any) => r.role_type === "affiliate"
                )
                if (affiliateRateObj) {
                    setAffiliateRate(parseFloat(affiliateRateObj.commission_percentage))
                }
            }
        } catch (err) {
            console.error("Error fetching affiliate rate:", err)
        }
    }

    const fetchProducts = async (token: string) => {
        try {
            const response = await axios.get(`${BACKEND_URL}/affiliate/user/products`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            })

            const data = response.data
            setProducts(data.products || [])
            setAllProducts(data.allProducts || [])
            setCategories(data.categories || [])
        } catch (err: any) {
            console.error("Error fetching products:", err)
            setError(err.response?.data?.message || err.message || "Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600 font-medium">Loading products...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-emerald-900 bg-clip-text text-transparent">
                            Product Catalog
                        </h1>
                        <Sparkles className="text-emerald-500 animate-pulse" size={24} />
                    </div>
                    <p className="text-gray-600 text-lg">Browse products and see commission rates</p>
                </div>
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur opacity-50"></div>
                    <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg">
                        {filteredProducts.length} Products Available
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
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
                    {categories.map((category) => (
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

            {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl shadow-sm">
                    {error}
                </div>
            )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} user={user} affiliateRate={affiliateRate} />
                    ))}
                </div>
            )}
        </div>
    )
}

function ProductCard({ product, user, affiliateRate }: { product: Product; user: any; affiliateRate: number }) {
    const [copied, setCopied] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)

    const actualCommission = product.commissionAmount * (affiliateRate / 100)
    const platformFee = product.commissionAmount - actualCommission

    const handleShare = () => {
        const referralCode = user?.refer_code || ''
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`

        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-teal-50/0 group-hover:from-emerald-50/50 group-hover:to-teal-50/30 transition-all duration-300 pointer-events-none"></div>

            <button
                onClick={handleShare}
                className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md hover:bg-emerald-500 text-gray-700 hover:text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 hover:rotate-12"
                title="Share product with your referral link"
            >
                <Share2 size={18} />
            </button>

            {copied && (
                <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium px-4 py-2 rounded-full shadow-xl animate-bounce">
                    ✓ Link copied!
                </div>
            )}

            <div className="relative h-56 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {product.thumbnail ? (
                    <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <Box className="text-gray-300 group-hover:text-emerald-300 transition-colors" size={80} />
                )}
            </div>

            <div className="relative p-6 space-y-4">
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

                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                    {product.description || "No description available"}
                </p>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-yellow-400 text-lg">★</span>
                        <span className="text-sm font-semibold text-gray-700">4.5</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gradient-to-r from-gray-100 to-slate-100 px-3 py-1.5 rounded-full border border-gray-200">
                        {product.category}
                    </span>
                </div>

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

                {product.inventoryQuantity > 0 && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 px-3 py-2 rounded-lg">
                        <Box size={16} className="text-gray-400" />
                        <span className="font-medium">{product.inventoryQuantity} units available</span>
                    </div>
                )}

                {product.commissionRate && (
                    <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-[2px] shadow-lg shadow-emerald-200">
                        <div className="bg-white rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-600">Commission:</span>
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
                                                    <span>Affiliate Share ({affiliateRate}%):</span>
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
            </div>
        </div>
    )
}
