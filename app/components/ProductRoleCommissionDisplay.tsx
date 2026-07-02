import {
    formatCommissionInr,
    formatCommissionRatePercent,
    seEffectiveCommissionRate,
    seTotalCommission,
} from "@/lib/se-product-commission-display"

interface ThemeColors {
    primary: string
    primaryLight: string
}

export interface ProductRoleCommissionInput {
    productCommissionRate: number | null
    productCommissionAmount: number
    productPrice: number
    roleDirectRate: number
    additionalCommissionRate?: number
    /** State admin: when roleDirectRate is 0, fall back to full pool amount */
    useStateAdminFallback?: boolean
}

export function getProductRoleCommissionValues({
    productCommissionRate,
    productCommissionAmount,
    productPrice,
    roleDirectRate,
    additionalCommissionRate = 0,
    useStateAdminFallback = false,
}: ProductRoleCommissionInput) {
    const regularCommission =
        roleDirectRate > 0 || !useStateAdminFallback
            ? productCommissionAmount * (roleDirectRate / 100)
            : productCommissionAmount

    const effectiveCommissionRate = seEffectiveCommissionRate(
        productCommissionRate ?? 0,
        roleDirectRate,
    )

    const additionalCommissionAmount = productPrice * (additionalCommissionRate / 100)
    const totalCommission = seTotalCommission(regularCommission, additionalCommissionAmount)

    return {
        regularCommission,
        effectiveCommissionRate,
        additionalCommissionAmount,
        totalCommission,
    }
}

export function ProductRoleCommissionRateBadge({
    productCommissionRate,
    roleDirectRate,
    theme,
}: {
    productCommissionRate: number | null
    roleDirectRate: number
    theme: ThemeColors
}) {
    if (!productCommissionRate) return null

    const { effectiveCommissionRate } = getProductRoleCommissionValues({
        productCommissionRate,
        productCommissionAmount: 0,
        productPrice: 0,
        roleDirectRate,
    })

    return (
        <span className="text-sm font-medium" style={{ color: theme.primary }}>
            {formatCommissionRatePercent(effectiveCommissionRate)}%
        </span>
    )
}

export function ProductRoleCommissionDisplay({
    productCommissionRate,
    productCommissionAmount,
    productPrice,
    roleDirectRate,
    additionalCommissionRate = 0,
    useStateAdminFallback = false,
    theme,
}: ProductRoleCommissionInput & { theme: ThemeColors }) {
    if (!productCommissionRate) return null

    const {
        regularCommission,
        additionalCommissionAmount,
        totalCommission,
    } = getProductRoleCommissionValues({
        productCommissionRate,
        productCommissionAmount,
        productPrice,
        roleDirectRate,
        additionalCommissionRate,
        useStateAdminFallback,
    })

    return (
        <>
            <div
                className="rounded-lg px-3 py-2"
                style={{
                    backgroundColor: theme.primaryLight,
                    border: `1px solid ${theme.primary}20`,
                }}
            >
                <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Your commission:</span>
                    <span className="font-bold text-lg" style={{ color: theme.primary }}>
                        ₹{formatCommissionInr(regularCommission)}
                    </span>
                </div>
            </div>

            {additionalCommissionRate > 0 && (
                <>
                    <div className="mt-2 rounded-lg px-3 py-2 space-y-1 bg-emerald-50 border border-emerald-200">
                        <div className="text-xs font-medium text-emerald-700">Additional Commission</div>
                        <div className="text-sm font-semibold text-emerald-700">
                            +{additionalCommissionRate}% (₹
                            {formatCommissionInr(additionalCommissionAmount)})
                        </div>
                    </div>
                    <div
                        className="mt-2 rounded-lg px-3 py-2 bg-white"
                        style={{ border: `2px solid ${theme.primary}40` }}
                    >
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-800">Total Commission</span>
                            <span className="text-lg font-bold" style={{ color: theme.primary }}>
                                ₹{formatCommissionInr(totalCommission)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
