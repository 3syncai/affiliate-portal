/**
 * Return-request lifecycle statuses stored on `return_request.status`.
 *
 * Only admin-approved returns void affiliate commission and stop the
 * post-delivery unlock timer. A customer filing a return (`pending_approval`)
 * keeps the countdown running until an admin approves.
 */
export const RETURN_REQUEST_REJECTED_STATUSES = [
  "rejected",
  "cancelled",
  "canceled",
] as const;

export const RETURN_REQUEST_PENDING_STATUSES = [
  "pending_approval",
  "pending",
  "requested",
] as const;

/** Admin approved the return — commission must be voided immediately. */
export const RETURN_REQUEST_APPROVED_STATUSES = [
  "approved",
  "pickup_initiated",
  "refunded",
  "received",
] as const;

function normalizeReturnStatus(status?: string | null): string {
  return (status || "").trim().toLowerCase();
}

const rejectedSet = new Set<string>(RETURN_REQUEST_REJECTED_STATUSES);
const pendingSet = new Set<string>(RETURN_REQUEST_PENDING_STATUSES);
const approvedSet = new Set<string>(RETURN_REQUEST_APPROVED_STATUSES);

export function isRejectedReturnStatus(status?: string | null): boolean {
  return rejectedSet.has(normalizeReturnStatus(status));
}

export function isPendingReturnStatus(status?: string | null): boolean {
  return pendingSet.has(normalizeReturnStatus(status));
}

export function isApprovedReturnStatus(status?: string | null): boolean {
  return approvedSet.has(normalizeReturnStatus(status));
}

/** SQL literal list for `LOWER(status) IN (...)` fragments. */
export function returnStatusSqlList(
  statuses: readonly string[],
): string {
  return statuses.map((s) => `'${s}'`).join(",");
}
