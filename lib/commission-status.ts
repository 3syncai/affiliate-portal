export type CommissionStatus = "PENDING" | "CREDITED";

const CREDITED_ORDER_STATUSES = new Set([
    "CREDITED",
    "COMPLETED",
    "DELIVERED",
    "DELIVERED_TO_CUSTOMER",
    "FULFILLED",
]);

export function normalizeCommissionStatus(status?: string | null): CommissionStatus {
    const normalizedStatus = status?.trim().toUpperCase();

    if (normalizedStatus && CREDITED_ORDER_STATUSES.has(normalizedStatus)) {
        return "CREDITED";
    }

    return "PENDING";
}

export function isCommissionCreditedStatus(status?: string | null): boolean {
    return normalizeCommissionStatus(status) === "CREDITED";
}
