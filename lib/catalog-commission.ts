import type { Pool } from "pg";
export type CommissionDb = Pick<Pool, "query">;
export class CatalogCommissionConflict extends Error {}

/** Follow server-owned catalog_product_id links only; never match titles or SKUs. */
export async function catalogCommissionFamily(db: CommissionDb, productId: string): Promise<string[]> {
  const path: string[] = [];
  let current = productId;
  while (current) {
    if (path.includes(current) || path.length >= 32) throw new CatalogCommissionConflict("Invalid catalog linkage; ask the catalog admin to repair it.");
    path.push(current);
    const result = await db.query("SELECT id, metadata FROM product WHERE id=$1 AND deleted_at IS NULL", [current]);
    const product = result.rows[0];
    if (!product) throw new CatalogCommissionConflict("Catalog product is missing or deleted.");
    const parent = product.metadata?.catalog_product_id;
    if (!parent || parent === current) break;
    if (typeof parent !== "string") throw new CatalogCommissionConflict("Invalid catalog linkage.");
    current = parent;
  }
  const canonical = path[path.length - 1];
  const result = await db.query(
    `WITH RECURSIVE family AS (
      SELECT id, ARRAY[id::text] AS visited FROM product WHERE id=$1 AND deleted_at IS NULL
      UNION ALL
      SELECT p.id, f.visited || p.id::text FROM product p JOIN family f
        ON p.metadata->>'catalog_product_id'=f.id
      WHERE p.deleted_at IS NULL AND NOT p.id=ANY(f.visited) AND cardinality(f.visited)<32
    ) SELECT DISTINCT id FROM family ORDER BY id`, [canonical]);
  return [canonical, ...result.rows.map(row => String(row.id)).filter(id => id !== canonical)];
}

export type CommissionRule = { id: string; rate: number; source: string; categoryId: string | null };
export async function lookupCatalogCommission(db: CommissionDb, productId: string): Promise<CommissionRule | null> {
  const family = await catalogCommissionFamily(db, productId);
  const direct = await db.query(
    "SELECT id, commission_rate FROM affiliate_commission WHERE product_id=ANY($1::text[]) AND deleted_at IS NULL ORDER BY id", [family]);
  if (direct.rows.length) {
    const rates = new Set(direct.rows.map(row => Number(row.commission_rate)));
    if (rates.size !== 1) throw new CatalogCommissionConflict("Linked listings have conflicting commission rules. Set one common catalog rate first.");
    const row = direct.rows[0];
    const rate = Number(row.commission_rate);
    if (!validCommissionRate(rate)) throw new CatalogCommissionConflict("Invalid catalog commission rate.");
    return { id: row.id, rate, source: "catalog", categoryId: null };
  }
  // Canonical fallback metadata keeps the rate identical across vendor listings.
  const fallback = await db.query(
    `WITH RECURSIVE categories AS (
      SELECT pc.id, pc.parent_category_id FROM product_category pc JOIN product_category_product link
        ON link.product_category_id=pc.id WHERE link.product_id=$1 AND pc.deleted_at IS NULL
      UNION
      SELECT pc.id, pc.parent_category_id FROM product_category pc JOIN categories c ON c.parent_category_id=pc.id
        WHERE pc.deleted_at IS NULL
    ) SELECT ac.id, ac.commission_rate, ac.category_id,
      CASE WHEN ac.category_id IS NOT NULL THEN 'category' WHEN ac.collection_id IS NOT NULL THEN 'collection' ELSE 'type' END AS source
      FROM affiliate_commission ac JOIN product p ON p.id=$1
      WHERE ac.deleted_at IS NULL AND ac.product_id IS NULL AND (
        ac.category_id IN (SELECT id FROM categories)
        OR (ac.category_id IS NULL AND ac.collection_id=p.collection_id)
        OR (ac.category_id IS NULL AND ac.collection_id IS NULL AND ac.type_id=p.type_id))
      ORDER BY CASE WHEN ac.category_id IS NOT NULL THEN 1 WHEN ac.collection_id IS NOT NULL THEN 2 ELSE 3 END,
        ac.commission_rate DESC, ac.id LIMIT 1`, [family[0]]);
  const row = fallback.rows[0];
  if (!row) return null;
  const rate = Number(row.commission_rate);
  if (!validCommissionRate(rate)) throw new CatalogCommissionConflict("Invalid commission rate.");
  return { id: row.id, rate, source: row.source, categoryId: row.category_id };
}

export async function lockCatalogCommission(db: CommissionDb, productId: string) {
  const family = await catalogCommissionFamily(db, productId);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["catalog-commission:" + family[0]]);
  return family;
}

/** Updating any sibling consolidates legacy rules into one canonical rule. */
export async function saveCatalogCommission(db: CommissionDb, productId: string, rate: number, id: string) {
  const family = await lockCatalogCommission(db, productId);
  await db.query("DELETE FROM affiliate_commission WHERE product_id=ANY($1::text[])", [family]);
  const result = await db.query(
    "INSERT INTO affiliate_commission(id,product_id,commission_rate) VALUES($1,$2,$3) RETURNING *", [id, family[0], rate]);
  return { ...result.rows[0], linked_listing_count: family.length };
}

export function validCommissionRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
export function commissionAmounts(amount: number, rate: number, share: number) {
  const base = Math.round((amount * rate / 100 + Number.EPSILON) * 100) / 100;
  return { base, earned: Math.round((base * share / 100 + Number.EPSILON) * 100) / 100 };
}

/** One batched query for catalog screens; same precedence as the event resolver. */
export async function listCatalogCommissionRates(db: CommissionDb) {
  const result = await db.query(`WITH RECURSIVE lineage AS (
    SELECT p.id AS listing_id, p.id, p.metadata, ARRAY[p.id::text] AS visited FROM product p WHERE p.deleted_at IS NULL
    UNION ALL
    SELECT l.listing_id, p.id, p.metadata, l.visited || p.id::text FROM lineage l
    JOIN product p ON p.id=l.metadata->>'catalog_product_id'
    WHERE p.deleted_at IS NULL AND NOT p.id=ANY(l.visited) AND cardinality(l.visited)<32
  ), roots AS (
    SELECT listing_id, id AS root_id FROM lineage
    WHERE COALESCE(metadata->>'catalog_product_id','') IN ('',id)
  ), direct AS (
    SELECT r.root_id, MIN(ac.id) AS id, MIN(ac.commission_rate) AS rate,
      COUNT(DISTINCT ac.commission_rate) AS rate_count
    FROM roots r JOIN affiliate_commission ac ON ac.product_id=r.listing_id AND ac.deleted_at IS NULL
    GROUP BY r.root_id
  ), cats AS (
    SELECT DISTINCT r.root_id, pc.id, pc.parent_category_id FROM roots r
    JOIN product_category_product link ON link.product_id=r.root_id
    JOIN product_category pc ON pc.id=link.product_category_id WHERE pc.deleted_at IS NULL
    UNION
    SELECT c.root_id, pc.id, pc.parent_category_id FROM cats c JOIN product_category pc ON pc.id=c.parent_category_id WHERE pc.deleted_at IS NULL
  ), fallback AS (
    SELECT r.root_id, ac.id, ac.commission_rate AS rate,
      CASE WHEN ac.category_id IS NOT NULL THEN 'category' WHEN ac.collection_id IS NOT NULL THEN 'collection' ELSE 'type' END AS source,
      ROW_NUMBER() OVER(PARTITION BY r.root_id ORDER BY
        CASE WHEN ac.category_id IS NOT NULL THEN 1 WHEN ac.collection_id IS NOT NULL THEN 2 ELSE 3 END,
        ac.commission_rate DESC,ac.id) AS rank
    FROM (SELECT DISTINCT root_id FROM roots) r JOIN product p ON p.id=r.root_id
    JOIN affiliate_commission ac ON ac.product_id IS NULL AND ac.deleted_at IS NULL AND (
      ac.category_id IN (SELECT c.id FROM cats c WHERE c.root_id=r.root_id)
      OR (ac.category_id IS NULL AND ac.collection_id=p.collection_id)
      OR (ac.category_id IS NULL AND ac.collection_id IS NULL AND ac.type_id=p.type_id))
  ) SELECT p.id, r.root_id,
    CASE WHEN d.id IS NOT NULL THEN CASE WHEN d.rate_count=1 THEN d.rate ELSE NULL END ELSE f.rate END AS rate,
    CASE WHEN d.id IS NOT NULL THEN 'catalog' ELSE f.source END AS source,
    COALESCE(d.rate_count>1,false) AS conflict
    FROM product p LEFT JOIN roots r ON r.listing_id=p.id
    LEFT JOIN direct d ON d.root_id=r.root_id
    LEFT JOIN fallback f ON f.root_id=r.root_id AND f.rank=1 WHERE p.deleted_at IS NULL`);
  return new Map<string, { catalogId: string | null; rate: number | null; source: string | null; conflict: boolean }>(
    result.rows.map(row => [row.id, { catalogId: row.root_id, rate: row.rate == null ? null : Number(row.rate), source: row.source, conflict: row.conflict }]));
}
