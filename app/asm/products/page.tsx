"use client"

import { useEffect, useState } from "react"
import { Search, Package, IndianRupee, Box, Share2 } from "lucide-react"
import axios from "axios"
import { BACKEND_URL, STORE_URL } from "@/lib/config"
import { useTheme } from "@/contexts/ThemeContext"
import {
    ProductRoleCommissionDisplay,
    ProductRoleCommissionRateBadge,
} from "@/app/components/ProductRoleCommissionDisplay"

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

export default function ASMProductsPage() {
    const { theme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)
    const [additionalByProduct, setAdditionalByProduct] = useState<Record<string, number>>({})

    const [commissionRate, setCommissionRate] = useState<number>(0)

    useEffect(() => {
        const userData = localStorage.getItem("affiliate_user")
        const token = localStorage.getItem("affiliate_token")
        if (userData) {
            setUser(JSON.parse(userData))
        }
        if (token) {
            fetchProducts(token)
            fetchCommissionRates()
            fetchAdditionalCommissions("asm")
        } else {
            setLoading(false)
            setError("Not authenticated")
        }
    }, [])

    const fetchCommissionRates = async () => {
        try {
            const response = await axios.get("/api/admin/commission-rates")
            if (response.data.success && response.data.summary?.asm) {
                setCommissionRate(Number(response.data.summary.asm.directRate) || 0)
            }
        } catch (err) {
            console.error("Error fetching commission rates:", err)
            setCommissionRate(0)
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
        } catch (err: any) {
            console.error("Error fetching products:", err)
            setError(err.response?.data?.message || err.message || "Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    const fetchAdditionalCommissions = async (role: string) => {
        try {
            const response = await axios.get(`/api/additional-commissions/active?role=${encodeURIComponent(role)}`)
            const productRates: Record<string, number> = {}
            for (const row of response.data?.campaigns || []) {
                const productId = String(row.product_id || "")
                const rate = Number(row.additional_rate || 0)
                if (!productId) continue
                if (!productRates[productId] || rate > productRates[productId]) {
                    productRates[productId] = rate
                }
            }
            setAdditionalByProduct(productRates)
        } catch (err) {
            console.error("Error fetching additional commissions:", err)
        }
    }

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
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Loading products...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Commission Overview</h1>
                    <p className="text-gray-600 mt-1">Direct sales earn you maximum commission</p>
                </div>
                <div className="px-4 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {filteredProducts.length} Products Available
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    />
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCategory("all")}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === "all"
                            ? "text-white bg-blue-600"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        All Categories
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === category
                                ? "text-white bg-blue-600"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {category}
                        </button>
                    ))}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            user={user}
                            theme={theme}
                            commissionRate={commissionRate}
                            additionalCommissionRate={additionalByProduct[product.id] || 0}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function ProductCard({ product, user, theme, commissionRate, additionalCommissionRate }: { product: Product; user: any; theme: any; commissionRate: number; additionalCommissionRate: number }) {
    const [copied, setCopied] = useState(false)

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
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow relative">
            {/* Share Button */}
            <button
                onClick={handleShare}
                className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm hover:bg-emerald-50 text-gray-700 hover:text-emerald-600 p-2 rounded-full shadow-md transition-all"
                title="Share product with referral link">
                <Share2 size={18} />
            </button>

            {copied && (
                <div className="absolute top-3 left-3 z-10 bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                    Link copied!
                </div>
            )}

            <div className="h-48 bg-white flex items-center justify-center p-4">
                {product.thumbnail ? (
                    <img src={product.thumbnail} alt={product.title} className="w-full h-full object-contain" />
                ) : (
                    <Box className="text-gray-300" size={64} />
                )}
            </div>

            <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-2">
                        {product.title}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${product.isInStock
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                        }`}>
                        {product.isInStock ? "In Stock" : "Out of Stock"}
                    </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description || "No description available"}
                </p>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm text-gray-600">4.5</span>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {product.category}
                    </span>
                </div>

                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                        <IndianRupee size={16} className="text-gray-700" />
                        <span className="text-xl font-bold text-gray-900">
                            {product.price.toLocaleString("en-IN")}
                        </span>
                    </div>
                    <ProductRoleCommissionRateBadge
                        productCommissionRate={product.commissionRate}
                        roleDirectRate={commissionRate}
                        theme={theme}
                    />
                </div>

                {product.inventoryQuantity > 0 && (
                    <div className="flex items-center gap-1 text-gray-500 text-sm mb-3">
                        <Box size={14} />
                        <span>{product.inventoryQuantity} units available</span>
                    </div>
                )}

                <ProductRoleCommissionDisplay
                    productCommissionRate={product.commissionRate}
                    productCommissionAmount={product.commissionAmount}
                    productPrice={product.price}
                    roleDirectRate={commissionRate}
                    additionalCommissionRate={additionalCommissionRate}
                    theme={theme}
                />
            </div>
        </div>
    )
}
