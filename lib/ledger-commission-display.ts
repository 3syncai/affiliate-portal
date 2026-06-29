import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";

/**
 * Reconstructs the commission as originally earned, even after void sets
 * affiliate_commission to 0. commission_amount and affiliate_rate are kept on
 * the row for audit.
 */
export function ledgerOriginalCommissionSql(affiliateRateDecimal?: number): string {
  const affiliateFallback =
    affiliateRateDecimal != null
      ? `, acl.commission_amount * ${affiliateRateDecimal}`
      : "";

  return `COALESCE(
    NULLIF(acl.affiliate_commission, 0),
    acl.commission_amount * COALESCE(acl.affiliate_rate, 0) / 100.0
    ${affiliateFallback}
  )`;
}

/** SQL predicate: order commission was voided due to cancel or approved return. */
export const LEDGER_VOIDED_COMMISSION_SQL = `
  acl.status = 'CANCELLED' OR (${COMMISSION_HAS_RETURN_SQL})
`;

/**
 * Display amount for ledger tables: positive when active, negative when
 * cancelled/returned so admins can see lost earnings.
 */
export function ledgerDisplayCommissionSql(affiliateRateDecimal?: number): string {
  const original = ledgerOriginalCommissionSql(affiliateRateDecimal);
  return `CASE
    WHEN ${LEDGER_VOIDED_COMMISSION_SQL} THEN -ABS(${original})
    ELSE ${original}
  END`;
}

export function isVoidedLedgerEntry(row: {
  status?: string | null;
  has_return?: boolean | null;
}): boolean {
  return row.status === "CANCELLED" || Boolean(row.has_return);
}

export function formatSignedCommission(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = `₹${abs.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  if (amount < 0) return `-${formatted}`;
  if (amount > 0) return `+${formatted}`;
  return formatted;
}

export function ledgerCommissionClass(amount: number, voided?: boolean): string {
  if (voided || amount < 0) return "text-red-600 font-bold";
  if (amount > 0) return "text-emerald-600 font-bold";
  return "text-gray-400 font-bold";
}
