type QueryResultRow = {
    id?: string;
    role_type: string;
    commission_percentage: string | number | null;
    description?: string | null;
    updated_at?: string | Date | null;
};

type Queryable = {
    query: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[] }>;
};

export type CommissionRateMap = {
    affiliate: number;
    branch: number;
    branch_direct: number;
    area: number;
    state: number;
};

export type CommissionRoleSummary = {
    directRate: number;
    overrideRate: number;
};

export type CommissionRateSummary = {
    affiliate: CommissionRoleSummary;
    branch: CommissionRoleSummary;
    asm: CommissionRoleSummary;
    state: CommissionRoleSummary;
};

export type CommissionRatesPayload = {
    rates: QueryResultRow[];
    ratesByRole: CommissionRateMap;
    summary: CommissionRateSummary;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toPercentage = (value: string | number | null | undefined) => {
    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const buildCommissionRateMap = (rows: QueryResultRow[] = []): CommissionRateMap => {
    const rawRates = rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.role_type] = toPercentage(row.commission_percentage);
        return acc;
    }, {});

    const legacyBranchDirectRate = rawRates.branch_direct ?? 0;
    const effectiveBranchRate = rawRates.branch ?? legacyBranchDirectRate;

    return {
        affiliate: rawRates.affiliate ?? 0,
        branch: effectiveBranchRate,
        branch_direct: legacyBranchDirectRate,
        area: rawRates.area ?? 0,
        state: rawRates.state ?? 0
    };
};

export const buildCommissionSummary = (ratesByRole: CommissionRateMap): CommissionRateSummary => {
    const branchDirectRate = roundToTwo(ratesByRole.affiliate + ratesByRole.branch);
    const asmDirectRate = roundToTwo(ratesByRole.affiliate + ratesByRole.branch + ratesByRole.area);
    const stateDirectRate = roundToTwo(
        Math.min(ratesByRole.affiliate + ratesByRole.branch + ratesByRole.area + ratesByRole.state, 100)
    );

    return {
        affiliate: {
            directRate: roundToTwo(ratesByRole.affiliate),
            overrideRate: 0
        },
        branch: {
            directRate: branchDirectRate,
            overrideRate: roundToTwo(ratesByRole.branch)
        },
        asm: {
            directRate: asmDirectRate,
            overrideRate: roundToTwo(ratesByRole.area)
        },
        state: {
            directRate: stateDirectRate,
            overrideRate: roundToTwo(ratesByRole.state)
        }
    };
};

export async function fetchCommissionRates(queryable: Queryable): Promise<CommissionRatesPayload> {
    const result = await queryable.query(
        `SELECT id, role_type, commission_percentage, description, updated_at
         FROM commission_rates
         ORDER BY CASE role_type
             WHEN 'affiliate' THEN 1
             WHEN 'branch' THEN 2
             WHEN 'branch_direct' THEN 3
             WHEN 'area' THEN 4
             WHEN 'state' THEN 5
             ELSE 99
         END`
    );

    const ratesByRole = buildCommissionRateMap(result.rows);

    return {
        rates: result.rows,
        ratesByRole,
        summary: buildCommissionSummary(ratesByRole)
    };
}
