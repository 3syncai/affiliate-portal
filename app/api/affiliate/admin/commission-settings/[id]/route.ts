import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { saveCatalogCommission, lockCatalogCommission, validCommissionRate, CatalogCommissionConflict } from "@/lib/catalog-commission";
import { requireCommissionAdmin } from "@/lib/auth/commission-admin";
export const dynamic = "force-dynamic";

async function mutate(req: NextRequest, id: string, remove: boolean) {
  const auth = requireCommissionAdmin(req);
  if (!auth.ok) return auth.res;
  const body = remove ? null : await req.json();
  if (!remove && !validCommissionRate(body.commission_rate))
    return NextResponse.json({ success: false, error: "Rate must be between 0 and 100" }, { status: 400 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const row = (await db.query("SELECT * FROM affiliate_commission WHERE id=$1 AND deleted_at IS NULL", [id])).rows[0];
    if (!row) { await db.query("ROLLBACK"); return NextResponse.json({ success: false, error: "Commission not found" }, { status: 404 }); }
    let commission;
    if (row.product_id) {
      if (remove) {
        const family = await lockCatalogCommission(db, row.product_id);
        await db.query("DELETE FROM affiliate_commission WHERE product_id=ANY($1::text[])", [family]);
      } else commission = await saveCatalogCommission(db, row.product_id, body.commission_rate, id);
    } else if (remove) await db.query("DELETE FROM affiliate_commission WHERE id=$1", [id]);
    else commission = (await db.query("UPDATE affiliate_commission SET commission_rate=$1,updated_at=NOW() WHERE id=$2 RETURNING *", [body.commission_rate,id])).rows[0];
    await db.query("COMMIT");
    return NextResponse.json({ success: true, commission });
  } catch (error) {
    await db.query("ROLLBACK");
    return NextResponse.json({ success: false, error: error instanceof CatalogCommissionConflict ? error.message : "Could not update commission" }, { status: error instanceof CatalogCommissionConflict ? 409 : 500 });
  } finally { db.release(); }
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { return mutate(req,(await params).id,false); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { return mutate(req,(await params).id,true); }
