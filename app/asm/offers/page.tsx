"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import axios from "axios"
import { Box, IndianRupee, Share2 } from "lucide-react"
import { STORE_URL } from "@/lib/config"

type AdditionalCampaign = {
  id: number
  product_id: string
  additional_rate: number
}

type Product = {
  id: string
  title: string
  description: string
  thumbnail: string | null
  price: number
  category: string
  isInStock: boolean
  inventoryQuantity: number
  commissionRate: number | null
  commissionAmount: number
}

const fetcher = (url: string) => axios.get(url).then((res) => res.data)

export default function ASMOffersPage() {
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [directRate, setDirectRate] = useState<number>(0)
  const { data, isLoading } = useSWR("/api/additional-commissions/active?role=branch", fetcher)
  const campaigns: AdditionalCampaign[] = data?.campaigns || []

  useEffect(() => {
    const token = localStorage.getItem("affiliate_token")
    const rawUser = localStorage.getItem("affiliate_user")
    if (rawUser) setUser(JSON.parse(rawUser))
    if (token) {
      void fetchProducts(token)
      void fetchRates()
    } else {
      setLoadingProducts(false)
    }
  }, [])

  const fetchProducts = async (token: string) => {
    try {
      const response = await axios.get("/api/products", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const rows = (response.data?.products || response.data?.allProducts || []) as any[]
      setProducts(
        rows.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description || "",
          thumbnail: p.thumbnail || null,
          price: Number(p.price || 0),
          category: p.category || "General",
          isInStock: Boolean(p.isInStock),
          inventoryQuantity: Number(p.inventoryQuantity || 0),
          commissionRate: p.commissionRate ? Number(p.commissionRate) : null,
          commissionAmount: Number(p.commissionAmount || 0),
        }))
      )
    } catch (error) {
      console.error("Failed to load products:", error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchRates = async () => {
    try {
      const response = await axios.get("/api/admin/commission-rates")
      if (response.data?.success && response.data?.summary?.asm) {
        setDirectRate(Number(response.data.summary.asm.directRate) || 0)
      }
    } catch (error) {
      console.error("Failed to load rates:", error)
    }
  }

  const additionalByProduct: Record<string, number> = campaigns.reduce((acc, row) => {
    const productId = String(row.product_id || "")
    const rate = Number(row.additional_rate || 0)
    if (!productId) return acc
    if (!acc[productId] || rate > acc[productId]) acc[productId] = rate
    return acc
  }, {} as Record<string, number>)

  const offerProducts = products.filter((p) => (additionalByProduct[p.id] || 0) > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Offers</h1>
        <p className="text-gray-600 mt-1">Additional commission offers visible to Branch or All.</p>
      </div>

      {isLoading || loadingProducts ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-gray-500">Loading offers...</div>
      ) : offerProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-gray-500">No active offers available for your role.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {offerProducts.map((product) => (
            <OfferCard
              key={product.id}
              product={product}
              user={user}
              directRate={directRate}
              additionalRate={additionalByProduct[product.id] || 0}
              accent="blue"
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OfferCard({
  product,
  user,
  directRate,
  additionalRate,
  accent,
}: {
  product: Product
  user: any
  directRate: number
  additionalRate: number
  accent: "blue" | "emerald"
}) {
  const [copied, setCopied] = useState(false)
  const actualCommission = product.commissionAmount * (directRate / 100)
  const additionalAmount = product.price * (additionalRate / 100)
  const accentText = accent === "blue" ? "text-blue-700" : "text-emerald-700"
  const accentBg = accent === "blue" ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"

  const handleShare = () => {
    const referralCode = user?.refer_code || ""
    const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const shareLink = `${STORE_URL}/productDetail/${slug}?id=${product.id}&sourceTag=${encodeURIComponent(product.category)}&ref=${referralCode}`
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-emerald-200 transition-all duration-300 hover:shadow-xl">
      <button onClick={handleShare} className="absolute top-4 right-4 z-10 bg-white/90 text-gray-700 hover:text-white hover:bg-emerald-500 p-3 rounded-full shadow-md transition-all" title="Share offer">
        <Share2 size={18} />
      </button>

      {copied && <div className="absolute top-4 left-4 z-10 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full">Link copied!</div>}

      <div className="h-52 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-5">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnail} alt={product.title} className="w-full h-full object-contain" />
        ) : (
          <Box className="text-gray-300" size={72} />
        )}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2">{product.title}</h3>
          <span className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ${product.isInStock ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
            {product.isInStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>

        <p className="text-gray-600 text-sm line-clamp-2">{product.description || "No description available"}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">{product.category}</span>
          {product.commissionRate && (
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
              {product.commissionRate}%
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <IndianRupee size={18} className="text-gray-700" />
            <span className="text-2xl font-bold text-gray-900">{product.price.toLocaleString("en-IN")}</span>
          </div>
          {product.inventoryQuantity > 0 && <span className="text-xs text-gray-500">{product.inventoryQuantity} units</span>}
        </div>

        <div className="rounded-xl border-2 border-emerald-500 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Your commission:</span>
            <span className="text-lg font-bold text-emerald-600">
              ₹{actualCommission.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className={`rounded-xl border px-4 py-3 ${accentBg}`}>
          <div className={`text-xs uppercase tracking-wide font-semibold ${accentText}`}>Additional Commission</div>
          <div className={`text-sm font-semibold mt-1 ${accentText}`}>
            +{additionalRate}% (₹
            {additionalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </div>
        </div>
      </div>
    </div>
  )
}
