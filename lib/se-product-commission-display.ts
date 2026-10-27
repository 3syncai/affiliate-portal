const roundToTwo = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

export function seEffectiveCommissionRate(
    productCommissionRate: number,
    affiliateRoleShare: number,
): number {
    return roundToTwo(productCommissionRate * (affiliateRoleShare / 100));
}

export function formatCommissionRatePercent(rate: number): string {
    const rounded = roundToTwo(rate);
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function seTotalCommission(regular: number, additional = 0): number {
    return roundToTwo(regular + additional);
}

export function formatCommissionInr(amount: number): string {
    return amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
