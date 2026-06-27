export type SaleLevelType =
    | "direct_sale"
    | "sales_executive_sale"
    | "asm_sale"
    | "branch_manager_sale";

export type RecentTransactionRow = {
    id: string;
    created_at: string;
    saleLevel: SaleLevelType;
    product_name: string;
    order_id: string;
    status?: string;
    unlock_at?: string | null;
    credited_at?: string | null;
    has_return?: boolean;
    has_return_request?: boolean;
    participant_name: string;
    participant_branch: string;
    commission_amount: number;
};

export const SALE_LEVEL_LABELS: Record<SaleLevelType, string> = {
    direct_sale: "Direct Sale",
    sales_executive_sale: "Sales Executive Sale",
    asm_sale: "ASM Sale",
    branch_manager_sale: "Branch Manager Sale",
};

export function saleLevelLabel(level: SaleLevelType): string {
    return SALE_LEVEL_LABELS[level];
}

export function saleLevelBadgeClass(level: SaleLevelType): string {
    switch (level) {
        case "direct_sale":
            return "bg-emerald-100 text-emerald-800";
        case "sales_executive_sale":
            return "bg-amber-100 text-amber-800";
        case "asm_sale":
            return "bg-blue-100 text-blue-800";
        case "branch_manager_sale":
            return "bg-purple-100 text-purple-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
}

export function saleLevelFromCommissionSource(
    commissionSource?: string | null,
    options?: { isDirect?: boolean },
): SaleLevelType {
    if (options?.isDirect) {
        return "direct_sale";
    }

    switch (commissionSource) {
        case "affiliate":
            return "sales_executive_sale";
        case "branch_admin":
            return "asm_sale";
        case "area_manager":
        case "asm_direct":
            return "branch_manager_sale";
        case "state_admin_direct":
            return "direct_sale";
        default:
            return "sales_executive_sale";
    }
}

export function saleLevelFromTypeLabel(typeLabel?: string | null): SaleLevelType {
    const normalized = String(typeLabel ?? "").trim().toLowerCase();

    if (normalized === "direct sale" || normalized === "direct") {
        return "direct_sale";
    }
    if (normalized === "sales executive sale" || normalized === "affiliate override") {
        return "sales_executive_sale";
    }
    if (normalized === "asm sale") {
        return "asm_sale";
    }
    if (normalized === "branch manager sale") {
        return "branch_manager_sale";
    }

    return "sales_executive_sale";
}

export function formatParticipantName(
    firstName?: string | null,
    lastName?: string | null,
    fallback = "Customer",
): string {
    const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
    return name || fallback;
}

export function formatTransactionCurrency(amount: number): string {
    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function formatTransactionDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
    });
}

type BranchOrderInput = {
    id: string;
    order_id: string;
    commission_amount: number | string;
    created_at: string;
    product_name: string;
    first_name?: string | null;
    last_name?: string | null;
    type?: string | null;
    participant_branch?: string | null;
    status?: string;
    unlock_at?: string | null;
    credited_at?: string | null;
    has_return?: boolean;
    has_return_request?: boolean;
};

export function mapBranchEarningsOrder(order: BranchOrderInput): RecentTransactionRow {
    const isDirect = order.type === "Direct Sale";

    return {
        id: order.id,
        created_at: order.created_at,
        saleLevel: saleLevelFromTypeLabel(order.type),
        product_name: order.product_name,
        order_id: order.order_id,
        status: order.status,
        unlock_at: order.unlock_at,
        credited_at: order.credited_at,
        has_return: order.has_return,
        has_return_request: order.has_return_request,
        participant_name: formatParticipantName(order.first_name, order.last_name),
        participant_branch: order.participant_branch?.trim() || (isDirect ? "Direct" : ""),
        commission_amount: Number.parseFloat(String(order.commission_amount ?? 0)) || 0,
    };
}

type BmOrderInput = {
    id: string;
    order_id: string;
    created_at: string;
    product_name: string;
    first_name?: string | null;
    last_name?: string | null;
    participant_name?: string | null;
    branch?: string | null;
    participant_branch?: string | null;
    commission_source?: string | null;
    commission_amount?: number | string | null;
    your_earning?: number | string | null;
    type?: string | null;
    status?: string;
    unlock_at?: string | null;
    credited_at?: string | null;
    has_return?: boolean;
    has_return_request?: boolean;
};

export function mapBmEarningsOrder(order: BmOrderInput): RecentTransactionRow {
    const isDirect =
        order.commission_source === "asm_direct" || order.branch === "BM Direct";

    return {
        id: order.id,
        created_at: order.created_at,
        saleLevel: order.type
            ? saleLevelFromTypeLabel(order.type)
            : saleLevelFromCommissionSource(order.commission_source, { isDirect }),
        product_name: order.product_name,
        order_id: order.order_id,
        status: order.status,
        unlock_at: order.unlock_at,
        credited_at: order.credited_at,
        has_return: order.has_return,
        has_return_request: order.has_return_request,
        participant_name:
            order.participant_name?.trim() ||
            formatParticipantName(order.first_name, order.last_name),
        participant_branch:
            order.participant_branch?.trim() ||
            order.branch?.trim() ||
            (isDirect ? "Direct" : ""),
        commission_amount:
            Number.parseFloat(String(order.your_earning ?? order.commission_amount ?? 0)) ||
            0,
    };
}

type StateOrderInput = {
    id: string;
    order_id: string;
    created_at: string;
    product_name: string;
    first_name?: string | null;
    last_name?: string | null;
    branch?: string | null;
    participant_branch?: string | null;
    type?: string | null;
    commission_amount?: number | string | null;
    status?: string;
    unlock_at?: string | null;
    credited_at?: string | null;
    has_return?: boolean;
    has_return_request?: boolean;
};

export function mapStateAdminEarningsOrder(order: StateOrderInput): RecentTransactionRow {
    return {
        id: order.id,
        created_at: order.created_at,
        saleLevel: saleLevelFromTypeLabel(order.type),
        product_name: order.product_name,
        order_id: order.order_id,
        status: order.status,
        unlock_at: order.unlock_at,
        credited_at: order.credited_at,
        has_return: order.has_return,
        has_return_request: order.has_return_request,
        participant_name: formatParticipantName(order.first_name, order.last_name, "You"),
        participant_branch:
            order.participant_branch?.trim() ||
            order.branch?.trim() ||
            "",
        commission_amount: Number.parseFloat(String(order.commission_amount ?? 0)) || 0,
    };
}
