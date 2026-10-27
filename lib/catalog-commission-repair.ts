import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { catalogCommissionFamily, commissionAmounts, lookupCatalogCommission, lockCatalogCommission, type CommissionDb } from "./catalog-commission";
import { COMMISSION_HAS_ANY_RETURN_REQUEST_SQL } from "./dashboard-return-sql";

export type RepairItem = { id: string; order_id: string; product_id: string; commission_source: string; affiliate_code: string; old_status: string; share: number; order_amount: number; rate: number; base: number; earned: number; rule_id: string; before: Record<string, unknown> };
export async function previewCatalogRepair(db: CommissionDb, productId: string, lock = false) {
  const family = lock ? await lockCatalogCommission(db, productId) : await catalogCommissionFamily(db, productId);
  const result = await db.query(`
    SELECT acl.* FROM affiliate_commission_log acl JOIN "order" o ON o.id=acl.order_id
    WHERE acl.product_id=ANY($1::text[])
      AND acl.status IN ('PENDING','CREDITED','RATE_MISSING')
      AND acl.commission_rate=0 AND acl.commission_amount=0 AND COALESCE(acl.affiliate_commission,0)=0
      AND COALESCE(acl.additional_commission_amount,0)=0
      AND o.deleted_at IS NULL AND o.canceled_at IS NULL AND LOWER(o.status::text) NOT IN ('canceled','cancelled')
      AND NOT (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL})
    ORDER BY acl.id LIMIT 1001 ${lock ? "FOR UPDATE OF acl, o" : ""}
  `, [family]);
  if (result.rows.length > 1000) throw new Error("More than 1000 entries need review; use a bounded offline repair.");
  const items: RepairItem[] = [];
  const rules = new Map<string, Awaited<ReturnType<typeof lookupCatalogCommission>>>();
  for (const row of result.rows) {
    if (!rules.has(row.product_id)) rules.set(row.product_id, await lookupCatalogCommission(db, row.product_id));
    const rule = rules.get(row.product_id);
    if (!rule || rule.rate <= 0) continue;
    const amount = Number(row.order_amount), share = Number(row.affiliate_rate);
    if (!Number.isFinite(amount) || amount <= 0 || row.affiliate_rate == null || !Number.isFinite(share) || share < 0 || share > 100) continue;
    const amounts = commissionAmounts(amount, rule.rate, share);
    items.push({ id: row.id, order_id: row.order_id, product_id: row.product_id, commission_source: row.commission_source,
      affiliate_code: row.affiliate_code, old_status: row.status, share, order_amount: amount, rate: rule.rate, ...amounts, rule_id: rule.id, before: row });
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  return { catalog_product_id: family[0], fingerprint, items };
}

/** Never touches a wallet. Repaired entries must pass the ordinary delivery/return hold. */
export async function applyCatalogRepair(db: PoolClient, productId: string, fingerprint: string, actor: string) {
  const preview = await previewCatalogRepair(db, productId, true);
  if (!fingerprint || preview.fingerprint !== fingerprint) throw new Error("Preview changed. Review the updated calculation before applying.");
  await db.query(`CREATE TABLE IF NOT EXISTS affiliate_commission_correction (
    id text PRIMARY KEY, ledger_id text NOT NULL UNIQUE, actor_id text NOT NULL,
    before_record jsonb NOT NULL, after_record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW()
  )`);
  for (const item of preview.items) {
    const after = { commission_rate: item.rate, commission_amount: item.base, affiliate_commission: item.earned,
      status: "PENDING", credited_at: null, unlock_at: null, rule_id: item.rule_id };
    await db.query(`INSERT INTO affiliate_commission_correction(id,ledger_id,actor_id,before_record,after_record)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`, ["correction_" + randomUUID(),item.id,actor,JSON.stringify(item.before),JSON.stringify(after)]);
    const updated = await db.query(`UPDATE affiliate_commission_log SET commission_rate=$2, commission_amount=$3, affiliate_commission=$4,
      status='PENDING', credited_at=NULL, unlock_at=NULL
      WHERE id=$1 AND commission_rate=0 AND commission_amount=0 AND COALESCE(affiliate_commission,0)=0 RETURNING id`,
      [item.id,item.rate,item.base,item.earned]);
    if (updated.rowCount !== 1) throw new Error("Commission changed during correction");
  }
  return preview.items.length;
}
