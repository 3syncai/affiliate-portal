import { COMMISSION_HAS_ANY_RETURN_REQUEST_SQL } from "@/lib/dashboard-return-sql";

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, string | number | null>[] }>;
};

export type TerritoryGrossCommission = {
  total: number;
  credited: number;
  pending: number;
};

const toAmount = (value: string | number | null | undefined) =>
  Number.parseFloat(String(value ?? 0)) || 0;

/** Zeroes gross pool when cancelled or an active return exists. */
const EFFECTIVE_GROSS_SQL = `
  CASE
    WHEN acl.status = 'CANCELLED' OR (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL}) THEN 0
    ELSE acl.commission_amount
  END
`;

const sumGrossByStatus = (alias = "g") => `
  COALESCE(SUM(CASE WHEN ${alias}.status = 'CREDITED' THEN ${alias}.effective_gross ELSE 0 END), 0) AS credited,
  COALESCE(SUM(CASE WHEN ${alias}.status = 'PENDING' THEN ${alias}.effective_gross ELSE 0 END), 0) AS pending
`;

const parseGrossRow = (
  row: Record<string, string | number | null> | undefined,
): TerritoryGrossCommission => {
  const credited = toAmount(row?.credited);
  const pending = toAmount(row?.pending);
  return { total: credited + pending, credited, pending };
};

const mergeGross = (
  ...parts: TerritoryGrossCommission[]
): TerritoryGrossCommission => {
  const credited = parts.reduce((sum, p) => sum + p.credited, 0);
  const pending = parts.reduce((sum, p) => sum + p.pending, 0);
  return { total: credited + pending, credited, pending };
};

async function sumEffectiveGross(
  pool: Queryable,
  sql: string,
  params: unknown[],
): Promise<TerritoryGrossCommission> {
  const result = await pool.query(
    `
    SELECT ${sumGrossByStatus("sub")}
    FROM (
      SELECT
        acl.status,
        ${EFFECTIVE_GROSS_SQL} AS effective_gross
      ${sql}
    ) sub
    `,
    params,
  );
  return parseGrossRow(result.rows[0]);
}

/** Sales executive personal earnings (affiliate_commission on their sales). */
export async function getSalesExecutiveCommission(
  pool: Queryable,
  referCode: string,
  affiliateRateDecimal: number,
): Promise<TerritoryGrossCommission> {
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN acl.status = 'CREDITED'
          THEN COALESCE(acl.affiliate_commission, acl.commission_amount * $2)
          ELSE 0
        END
      ), 0) AS credited,
      COALESCE(SUM(
        CASE
          WHEN acl.status = 'PENDING'
            AND acl.status <> 'CANCELLED'
            AND NOT (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL})
          THEN COALESCE(acl.affiliate_commission, acl.commission_amount * $2)
          ELSE 0
        END
      ), 0) AS pending
    FROM affiliate_commission_log acl
    WHERE acl.affiliate_code = $1
    `,
    [referCode, affiliateRateDecimal],
  );
  return parseGrossRow(result.rows[0]);
}

/** ASM dashboard (`/branch`) — branch territory gross + own direct referrals. */
export async function getBranchTerritoryGross(
  pool: Queryable,
  branch: string,
  asmReferCode?: string,
): Promise<TerritoryGrossCommission> {
  const teamGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    INNER JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
    WHERE au.branch ILIKE $1
      AND acl.commission_source = 'affiliate'
    `,
    [branch],
  );

  if (!asmReferCode?.trim()) {
    return teamGross;
  }

  const directGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    WHERE acl.commission_source = 'branch_admin'
      AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($1))
    `,
    [asmReferCode],
  );

  return mergeGross(teamGross, directGross);
}

/** BM dashboard (`/asm`) — city+state territory gross + own direct referrals. */
export async function getBmTerritoryGross(
  pool: Queryable,
  city: string,
  state: string,
  bmReferCode?: string,
): Promise<TerritoryGrossCommission> {
  const affiliateGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
    JOIN stores s ON u.branch ILIKE s.branch_name
    WHERE s.city ILIKE $1
      AND s.state ILIKE $2
      AND acl.commission_source = 'affiliate'
    `,
    [city, state],
  );

  const asmDirectGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    JOIN branch_admin ba ON LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(ba.refer_code))
    WHERE ba.city ILIKE $1
      AND ba.state ILIKE $2
      AND acl.commission_source = 'branch_admin'
    `,
    [city, state],
  );

  const parts: TerritoryGrossCommission[] = [affiliateGross, asmDirectGross];

  if (bmReferCode?.trim()) {
    const bmDirectGross = await sumEffectiveGross(
      pool,
      `
      FROM affiliate_commission_log acl
      WHERE acl.commission_source = 'asm_direct'
        AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($1))
      `,
      [bmReferCode],
    );
    parts.push(bmDirectGross);
  }

  return mergeGross(...parts);
}

/** State head dashboard — state territory gross + own direct referrals. */
export async function getStateTerritoryGross(
  pool: Queryable,
  state: string,
  stateReferCode?: string,
): Promise<TerritoryGrossCommission> {
  const affiliateGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
    JOIN stores s ON u.branch ILIKE s.branch_name
    WHERE s.state ILIKE $1
      AND acl.commission_source = 'affiliate'
    `,
    [state],
  );

  const asmDirectGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    JOIN branch_admin ba ON LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(ba.refer_code))
    WHERE ba.state ILIKE $1
      AND acl.commission_source = 'branch_admin'
    `,
    [state],
  );

  const bmDirectGross = await sumEffectiveGross(
    pool,
    `
    FROM affiliate_commission_log acl
    JOIN area_sales_manager asm ON LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(asm.refer_code))
    WHERE asm.state ILIKE $1
      AND acl.commission_source = 'asm_direct'
    `,
    [state],
  );

  const parts: TerritoryGrossCommission[] = [
    affiliateGross,
    asmDirectGross,
    bmDirectGross,
  ];

  if (stateReferCode?.trim()) {
    const stateDirectGross = await sumEffectiveGross(
      pool,
      `
      FROM affiliate_commission_log acl
      WHERE acl.commission_source = 'state_admin_direct'
        AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($1))
      `,
      [stateReferCode],
    );
    parts.push(stateDirectGross);
  }

  return mergeGross(...parts);
}
