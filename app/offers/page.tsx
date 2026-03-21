"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import axios from "axios"
import UserNavbar from "../components/UserNavbar"
import { Box, IndianRupee, Percent, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { STORE_URL } from "@/lib/config"

type AdditionalCampaign = {
  id: number
  product_id: string
  product_name: string | null
  product_thumbnail?: string | null
  additional_rate: number
  target_role: string
  starts_at: string
  ends_at: string | null
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

export default function AffiliateOffersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [affiliateRate, setAffiliateRate] = useState<number>(100)

  useEffect(() => {
    try {
      const token = localStorage.getItem("affiliate_token")
      const rawUser = localStorage.getItem("affiliate_user")
      const role = localStorage.getItem("affiliate_role")

      if (!token || !rawUser) {
        router.push("/login")
        return
      }

      if (role === "admin") {
        router.push("/admin/dashboard")
        return
      }

      const parsed = JSON.parse(rawUser || "null")
      setUser(parsed)
      void fetchProducts(token)
      void fetchAffiliateRate()
    } catch {
      router.push("/login")
    }
  }, [router])

  const fetchProducts = async (token: string) => {
    try {
      const response = await axios.get("/api/products", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const rows = (response.data?.products || []) as any[]
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
      console.error("Failed to load offer products:", error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchAffiliateRate = async () => {
    try {
      const response = await axios.get("/api/admin/commission-rates")
      if (response.data?.success && response.data?.rates) {
        const affiliateRateObj = response.data.rates.find((r: any) => r.role_type === "affiliate")
        if (affiliateRateObj) {
          setAffiliateRate(Number(affiliateRateObj.commission_percentage) || 100)
        }
      }
    } catch (error) {
      console.error("Failed to load affiliate rate:", error)
    }
  }

  const userName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email

  const { data, isLoading } = useSWR("/api/additional-commissions/active?role=partner", fetcher)
  const campaigns: AdditionalCampaign[] = data?.campaigns || []
  const additionalByProduct: Record<string, number> = campaigns.reduce((acc, row) => {
    const productId = String(row.product_id || "")
    const rate = Number(row.additional_rate || 0)
    if (!productId) return acc
    if (!acc[productId] || rate > acc[productId]) {
      acc[productId] = rate
    }
    return acc
  }, {} as Record<string, number>)

  const offerProducts = products.filter((p) => (additionalByProduct[p.id] || 0) > 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
      <UserNavbar userName={userName} />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Offers</h1>
            <p className="text-gray-600 mt-1">Active additional commission offers for Partner or All.</p>
          </div>

          {isLoading || loadingProducts ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-gray-500">Loading offers...</div>
          ) : offerProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-gray-500">
              No active offers available for your role.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {offerProducts.map((product) => (
                <OfferProductCard
                  key={product.id}
                  product={product}
                  user={user}
                  affiliateRate={affiliateRate}
                  additionalCommissionRate={additionalByProduct[product.id] || 0}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function OfferProductCard({
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
  const actualCommission = product.commissionAmount * (affiliateRate / 100)
  const additionalCommissionAmount = product.price * (additionalCommissionRate / 100)

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
    <div className="group relative bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-1">
      <button
        onClick={handleShare}
        className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md hover:bg-emerald-500 text-gray-700 hover:text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110"
        title="Share product with your referral link"
      >
        <Share2 size={18} />
      </button>

      {copied && (
        <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium px-4 py-2 rounded-full shadow-xl">
          ✓ Link copied!
        </div>
      )}

      <div className="relative h-56 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6 overflow-hidden">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
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
          <span
            className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap shadow-sm ${
              product.isInStock ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white" : "bg-gradient-to-r from-red-400 to-pink-500 text-white"
            }`}
          >
            {product.isInStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">{product.description || "No description available"}</p>

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

        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-[2px] shadow-lg shadow-emerald-200">
          <div className="bg-white rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Your commission:</span>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                ₹{actualCommission.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="text-xs uppercase tracking-wide font-semibold text-emerald-700">Additional Commission</div>
          <div className="text-sm font-semibold text-emerald-700 mt-1">
            +{additionalCommissionRate}% (₹
            {additionalCommissionAmount.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            )
          </div>
        </div>
      </div>
    </div>
  )
}
