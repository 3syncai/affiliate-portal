export type CommissionStatus = "PENDING" | "CREDITED";

/** Only explicit CREDITED from manual/admin paths maps to ledger CREDITED. */
const LEDGER_CREDITED_STATUSES = new Set(["CREDITED"]);

/**
 * Normalize external order/commission status for affiliate_commission_log.
 * Delivery states (DELIVERED, COMPLETED, FULFILLED) stay PENDING until the
 * post-delivery unlock window elapses via syncAffiliateCommissionStatuses.
 */
export function normalizeCommissionStatus(status?: string | null): CommissionStatus {
    const normalizedStatus = status?.trim().toUpperCase();

    if (normalizedStatus && LEDGER_CREDITED_STATUSES.has(normalizedStatus)) {
        return "CREDITED";
    }

    return "PENDING";
}

export function isCommissionCreditedStatus(status?: string | null): boolean {
    return normalizeCommissionStatus(status) === "CREDITED";
}

/** True when the payload indicates the order was delivered (starts unlock window). */
export function isOrderDeliveredStatus(status?: string | null): boolean {
    const normalizedStatus = status?.trim().toUpperCase();
    if (!normalizedStatus) return false;
    return [
        "DELIVERED",
        "DELIVERED_TO_CUSTOMER",
        "COMPLETED",
        "FULFILLED",
    ].includes(normalizedStatus);
}
