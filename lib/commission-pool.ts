/** Business labels intentionally differ from legacy database role names. */
export const NORMAL_COMMISSION_ROLES = ["affiliate", "branch", "area", "state"] as const;
export const COMMISSION_POOL_LABELS: Record<string, string> = {
  affiliate: "Sales Executive",
  branch: "Area Sales Manager (/bm)",
  area: "Branch Admin (/asm)",
  state: "State Head",
};
export type CommissionPercentage = string | number | null | undefined;
export class CommissionPoolValidationError extends Error {}

/** Integer hundredths avoid floating-point tolerances at the 100% boundary. */
export function commissionBasisPoints(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  const points = Number(whole || 0) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(points) && points >= 0 && points <= 10000 ? points : null;
}

export function normalCommissionPool(values: Record<string, CommissionPercentage>) {
  let totalBasisPoints = 0;
  let invalidRole: string | undefined;
  for (const role of NORMAL_COMMISSION_ROLES) {
    const points = commissionBasisPoints(values[role]);
    if (points === null) invalidRole ||= role;
    else totalBasisPoints += points;
  }
  const valid = !invalidRole && totalBasisPoints === 10000;
  const difference = Math.abs(10000 - totalBasisPoints) / 100;
  const error = invalidRole
    ? `${COMMISSION_POOL_LABELS[invalidRole]} must be between 0% and 100%, with at most two decimal places.`
    : valid ? "" : `Normal commission shares must total exactly 100%. Current total: ${(totalBasisPoints / 100).toFixed(2)}%. ${totalBasisPoints < 10000 ? "Add" : "Reduce"} ${difference.toFixed(2)}%.`;
  return { valid, totalBasisPoints, total: totalBasisPoints / 100, error };
}

export type CommissionRateUpdate = { role_type: string; commission_percentage: number };
export function parseCommissionRateUpdates(input: unknown): CommissionRateUpdate[] {
  if (!Array.isArray(input) || input.length === 0) throw new CommissionPoolValidationError("Provide at least one commission rate.");
  const allowed = new Set<string>([...NORMAL_COMMISSION_ROLES, "branch_direct"]);
  const seen = new Set<string>();
  return input.map(row => {
    if (!row || typeof row !== "object" || typeof row.role_type !== "string" || !allowed.has(row.role_type)) {
      throw new CommissionPoolValidationError("Unknown commission role.");
    }
    if (seen.has(row.role_type)) throw new CommissionPoolValidationError("Duplicate commission role.");
    seen.add(row.role_type);
    const points = commissionBasisPoints(row.commission_percentage);
    if (points === null) throw new CommissionPoolValidationError("Commission percentages must be between 0 and 100, with at most two decimal places.");
    return { role_type: row.role_type, commission_percentage: points / 100 };
  });
}
