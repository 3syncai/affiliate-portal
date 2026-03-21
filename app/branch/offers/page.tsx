"use client"

import useSWR from "swr"
import axios from "axios"

type AdditionalCampaign = {
  id: number
  product_id: string
  product_name: string | null
  additional_rate: number
  target_role: string
  starts_at: string
  ends_at: string | null
}

const fetcher = (url: string) => axios.get(url).then((res) => res.data)

export default function BranchOffersPage() {
  const { data, isLoading } = useSWR("/api/additional-commissions/active?role=asm", fetcher)
  const campaigns: AdditionalCampaign[] = data?.campaigns || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Offers</h1>
        <p className="text-gray-600 mt-1">
          Additional commission offers visible to ASM or All.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Additional Commission</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-gray-500">Loading offers...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-gray-500">No active offers available for your role.</div>
        ) : (
          <div className="p-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{campaign.product_name || campaign.product_id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Start: {new Date(campaign.starts_at).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-gray-500">
                      End: {campaign.ends_at ? new Date(campaign.ends_at).toLocaleString("en-IN") : "Not set"}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">+{Number(campaign.additional_rate || 0).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
