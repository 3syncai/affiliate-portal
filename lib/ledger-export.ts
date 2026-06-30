export function formatCommissionSourceLabel(source?: string | null): string {
  switch (String(source ?? "").trim().toLowerCase()) {
    case "affiliate":
      return "sales_executive";
    case "branch_admin":
      return "branch_admin";
    case "area_manager":
      return "area_manager";
    case "state_admin":
      return "state_admin";
    case "state_admin_direct":
      return "state_admin_direct";
    case "asm_direct":
      return "asm_direct";
    default:
      return String(source ?? "").trim() || "unknown";
  }
}

export function formatLedgerRoleLabel(item: {
  is_agent?: boolean | null;
  commission_source?: string | null;
}): string {
  if (item.is_agent) return "Sales Executive";
  if (item.commission_source === "state_admin" || item.commission_source === "state_admin_direct") {
    return "State Admin";
  }
  if (item.commission_source === "area_manager" || item.commission_source === "asm_direct") {
    return "Area Sales Manager";
  }
  if (
    item.commission_source === "branch_admin" ||
    (item.commission_source && item.commission_source.includes("branch"))
  ) {
    return "Branch Admin";
  }
  return "User";
}

export const LEDGER_CSV_HEADERS = [
  "Date",
  "Product",
  "Order ID",
  "Sale Location",
  "Sale By",
  "Sale By Code",
  "Quantity",
  "Item Price",
  "Order Amount",
  "Commission",
  "Status",
  "Source",
  "Role",
] as const;

export function formatLedgerExportDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
