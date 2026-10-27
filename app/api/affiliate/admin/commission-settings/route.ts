import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { catalogCommissionFamily, saveCatalogCommission, validCommissionRate, CatalogCommissionConflict } from "@/lib/catalog-commission";
import { requireCommissionAdmin } from "@/lib/auth/commission-admin";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireCommissionAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const result = await pool.query(`SELECT ac.*, p.title AS product_title, pc.name AS category_name,
      pcol.title AS collection_title, pt.value AS type_value
      FROM affiliate_commission ac LEFT JOIN product p ON p.id=ac.product_id
      LEFT JOIN product_category pc ON pc.id=ac.category_id
      LEFT JOIN product_collection pcol ON pcol.id=ac.collection_id
      LEFT JOIN product_type pt ON pt.id=ac.type_id WHERE ac.deleted_at IS NULL ORDER BY ac.id`);
    const commissions = await Promise.all(result.rows.map(async row => {
      let family: string[] = [];
      let catalog_error: string | null = null;
      if (row.product_id) {
        try { family = await catalogCommissionFamily(pool, row.product_id); }
        catch (error) { catalog_error = error instanceof Error ? error.message : "Invalid catalog"; }
      }
      return { ...row, commission_rate: Number(row.commission_rate),
        catalog_product_id: family[0] || null, linked_listing_count: family.length, catalog_error,
        product: row.product_id ? { id: row.product_id, title: row.product_title || "Unavailable product" } : null,
        category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
        collection: row.collection_id ? { id: row.collection_id, title: row.collection_title } : null,
        type: row.type_id ? { id: row.type_id, value: row.type_value } : null };
    }));
    return NextResponse.json({ success: true, commissions });
  } catch (error) {
    console.error("Load commission rules failed", error);
    return NextResponse.json({ success: false, error: "Could not load commission rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireCommissionAdmin(req);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const scopes = ["product_id", "category_id", "collection_id", "type_id"] as const;
  const selected = scopes.filter(scope => typeof body[scope] === "string" && body[scope].trim());
  if (selected.length !== 1 || !validCommissionRate(body.commission_rate))
    return NextResponse.json({ success: false, error: "Select one scope and a rate between 0 and 100" }, { status: 400 });
  const scope = selected[0], entityId = body[scope].trim(), id = "comm_" + randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let commission;
    if (scope === "product_id") commission = await saveCatalogCommission(client, entityId, body.commission_rate, id);
    else {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["commission-scope:" + scope + ":" + entityId]);
      const duplicate = await client.query("SELECT id FROM affiliate_commission WHERE " + scope + "=$1 AND deleted_at IS NULL", [entityId]);
      if (duplicate.rowCount) throw new CatalogCommissionConflict("A rule already exists for this scope. Edit that rule instead.");
      commission = (await client.query("INSERT INTO affiliate_commission(id," + scope + ",commission_rate) VALUES($1,$2,$3) RETURNING *", [id,entityId,body.commission_rate])).rows[0];
    }
    await client.query("COMMIT");
    return NextResponse.json({ success: true, commission });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ success: false, error: error instanceof CatalogCommissionConflict ? error.message : "Could not save commission" }, { status: error instanceof CatalogCommissionConflict ? 409 : 500 });
  } finally { client.release(); }
}
