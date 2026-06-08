/**
 * Whitelist of affiliate-system tables the debug controller may inspect or truncate.
 * Only these names are ever passed to SQL — never user-supplied strings directly.
 */
export interface AffiliateTableDef {
    table: string
    label: string
    group: "users" | "transactions" | "config" | "logs"
    /** If true, requires typing the exact table name to delete */
    protected?: boolean
}

export const AFFILIATE_TABLES: AffiliateTableDef[] = [
    { table: "affiliate_user", label: "Affiliates", group: "users" },
    { table: "branch_admin", label: "Branch Admins", group: "users" },
    { table: "area_sales_manager", label: "Area Managers (ASM)", group: "users" },
    { table: "state_admin", label: "State Admins", group: "users" },
    {
        table: "affiliate_admin",
        label: "Main Admin",
        group: "users",
        protected: true,
    },
    {
        table: "affiliate_commission_log",
        label: "Commission Log",
        group: "transactions",
    },
    { table: "withdrawal_request", label: "Withdrawal Requests", group: "transactions" },
    { table: "admin_payments", label: "Admin Payments", group: "transactions" },
    { table: "return_request", label: "Return Requests", group: "transactions" },
    {
        table: "additional_commissions",
        label: "Additional Commissions",
        group: "transactions",
    },
    { table: "activity_log", label: "Activity Log", group: "logs" },
    { table: "commission_rates", label: "Commission Rates", group: "config" },
    { table: "stores", label: "Stores", group: "config" },
]

/** Safe order for bulk truncate (children before parents where possible). */
export const TRUNCATE_ORDER = [
    "activity_log",
    "admin_payments",
    "withdrawal_request",
    "return_request",
    "affiliate_commission_log",
    "additional_commissions",
    "affiliate_user",
    "branch_admin",
    "area_sales_manager",
    "state_admin",
    "commission_rates",
    "stores",
    "affiliate_admin",
] as const

const TABLE_SET = new Set(AFFILIATE_TABLES.map((t) => t.table))

export function isAllowedAffiliateTable(name: string): boolean {
    return TABLE_SET.has(name)
}

export function getAffiliateTableDef(name: string): AffiliateTableDef | undefined {
    return AFFILIATE_TABLES.find((t) => t.table === name)
}

export const TRUNCATE_ALL_CONFIRM = "DELETE ALL AFFILIATE DATA"
