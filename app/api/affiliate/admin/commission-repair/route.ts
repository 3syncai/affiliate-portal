import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireCommissionAdmin } from "@/lib/auth/commission-admin";
import { previewCatalogRepair, applyCatalogRepair } from "@/lib/catalog-commission-repair";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireCommissionAdmin(req);
  if (!auth.ok) return auth.res;
  const productId = req.nextUrl.searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "Select a catalog product" }, { status: 400 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const preview = await previewCatalogRepair(db, productId);
    await db.query("COMMIT");
    // Full before-records stay server-side; only the calculation is sent to the admin.
    return NextResponse.json({ ...preview, items: preview.items.map(item => ({ id: item.id, order_id: item.order_id, product_id: item.product_id, commission_source: item.commission_source, affiliate_code: item.affiliate_code, old_status: item.old_status, share: item.share, order_amount: item.order_amount, rate: item.rate, base: item.base, earned: item.earned, rule_id: item.rule_id })) });
  } catch (error) {
    await db.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Preview failed" }, { status: 409 });
  } finally { db.release(); }
}
export async function POST(req: NextRequest) {
  const auth = requireCommissionAdmin(req);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (typeof body.product_id !== "string" || typeof body.fingerprint !== "string")
    return NextResponse.json({ error: "A reviewed preview is required" }, { status: 400 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const corrected = await applyCatalogRepair(db, body.product_id, body.fingerprint, auth.userId);
    await db.query("COMMIT");
    return NextResponse.json({ success: true, corrected, message: "Entries recalculated and pending delivery/return checks. No wallet credit issued." });
  } catch (error) {
    await db.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Correction failed" }, { status: 409 });
  } finally { db.release(); }
}
