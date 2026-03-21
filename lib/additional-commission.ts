import pool from "@/lib/db";

export type AdditionalVisibilityRole = "partner" | "asm" | "branch" | "state" | "all";

export type CommissionSource =
  | "affiliate"
  | "branch_admin"
  | "area_manager"
  | "state_admin"
  | "asm_direct"
  | "state_admin_direct"
  | string;

const VALID_VISIBILITY: AdditionalVisibilityRole[] = ["partner", "asm", "branch", "state", "all"];

export function normalizeVisibilityRole(value: string | null | undefined): AdditionalVisibilityRole {
  const normalized = String(value || "").trim().toLowerCase();
  return (VALID_VISIBILITY.includes(normalized as AdditionalVisibilityRole)
    ? normalized
    : "partner") as AdditionalVisibilityRole;
}

export function visibilityFromCommissionSource(source: CommissionSource): Exclude<AdditionalVisibilityRole, "all"> {
  const normalized = String(source || "").toLowerCase();

  if (normalized === "affiliate") return "partner";
  if (normalized === "branch_admin") return "branch";
  if (normalized === "area_manager" || normalized === "asm_direct") return "asm";
  if (normalized === "state_admin" || normalized === "state_admin_direct") return "state";

  return "partner";
}

export async function ensureAdditionalCommissionSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS additional_commissions (
      id BIGSERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT,
      additional_rate DECIMAL(10,2) NOT NULL CHECK (additional_rate >= 0),
      target_role TEXT NOT NULL CHECK (target_role IN ('partner','asm','branch','state','all')),
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_additional_commission_product_active
    ON additional_commissions(product_id, target_role, is_active, starts_at, ends_at)
  `);

  await pool.query(`
    ALTER TABLE affiliate_commission_log
    ADD COLUMN IF NOT EXISTS additional_commission_id BIGINT,
    ADD COLUMN IF NOT EXISTS additional_commission_rate DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS additional_commission_amount DECIMAL(12,2) DEFAULT 0
  `);
}

type CommissionLogRow = {
  id: string;
  product_id: string | null;
  order_amount: string | number | null;
  commission_source: string | null;
  affiliate_code: string | null;
  commission_amount: string | number | null;
  affiliate_rate: string | number | null;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDirectSellerRow(row: CommissionLogRow) {
  const source = String(row.commission_source || "").trim().toLowerCase();
  const affiliateCode = String(row.affiliate_code || "").trim().toUpperCase();

  if (source === "affiliate" || source === "asm_direct" || source === "state_admin_direct") {
    return true;
  }

  if (source === "branch_admin") {
    // Direct branch sales use the branch refer code.
    // Override entries use placeholders like BRANCH/AREA/STATE and should not receive additional bonus.
    return affiliateCode !== "BRANCH" && affiliateCode !== "AREA" && affiliateCode !== "STATE";
  }

  return false;
}

async function getBestCampaign(productId: string, role: Exclude<AdditionalVisibilityRole, "all">) {
  const result = await pool.query(
    `
      SELECT id, additional_rate
      FROM additional_commissions
      WHERE is_active = true
        AND product_id = $1
        AND starts_at <= NOW()
        AND (ends_at IS NULL OR ends_at >= NOW())
        AND (target_role = $2 OR target_role = 'all')
      ORDER BY additional_rate DESC, created_at DESC
      LIMIT 1
    `,
    [productId, role]
  );

  if (!result.rows.length) return null;
  return {
    id: Number(result.rows[0].id),
    additionalRate: toNumber(result.rows[0].additional_rate),
  };
}

export async function applyAdditionalCommissionForOrder(orderId: string) {
  const cleanOrderId = String(orderId || "").trim();
  if (!cleanOrderId) return;

  await ensureAdditionalCommissionSchema();

  const rowsResult = await pool.query<CommissionLogRow>(
    `
      SELECT id, product_id, order_amount, commission_source, affiliate_code, commission_amount, affiliate_rate
      FROM affiliate_commission_log
      WHERE order_id = $1
    `,
    [cleanOrderId]
  );

  if (!rowsResult.rows.length) return;

  for (const row of rowsResult.rows) {
    if (!row.product_id) continue;
    if (!isDirectSellerRow(row)) continue;

    const visibilityRole = visibilityFromCommissionSource(row.commission_source || "affiliate");
    const campaign = await getBestCampaign(row.product_id, visibilityRole);

    if (!campaign) {
      continue;
    }

    const orderAmount = toNumber(row.order_amount);
    const baseCommissionAmount = toNumber(row.commission_amount);
    const affiliateRate = toNumber(row.affiliate_rate);
    const additionalAmount = Number((orderAmount * (campaign.additionalRate / 100)).toFixed(2));
    const baseAffiliateCommission = Number((baseCommissionAmount * (affiliateRate / 100)).toFixed(2));
    const totalAffiliateCommission = Number((baseAffiliateCommission + additionalAmount).toFixed(2));

    await pool.query(
      `
        UPDATE affiliate_commission_log
        SET additional_commission_id = $2,
            additional_commission_rate = $3,
            additional_commission_amount = $4,
            affiliate_commission = $5
        WHERE id = $1
      `,
      [row.id, campaign.id, campaign.additionalRate, additionalAmount, totalAffiliateCommission]
    );
  }
}

export async function fetchActiveAdditionalCommissionsForRole(role: AdditionalVisibilityRole) {
  await ensureAdditionalCommissionSchema();

  const normalizedRole = normalizeVisibilityRole(role);
  const rows = await pool.query(
    `
      SELECT
        ac.id,
        ac.product_id,
        ac.product_name,
        ac.additional_rate,
        ac.target_role,
        ac.starts_at,
        ac.ends_at,
        p.thumbnail as product_thumbnail
      FROM additional_commissions ac
      LEFT JOIN product p ON p.id = ac.product_id
      WHERE ac.is_active = true
        AND ac.starts_at <= NOW()
        AND (ac.ends_at IS NULL OR ac.ends_at >= NOW())
        AND (ac.target_role = $1 OR ac.target_role = 'all')
      ORDER BY ac.additional_rate DESC, ac.created_at DESC
    `,
    [normalizedRole]
  );

  return rows.rows;
}
