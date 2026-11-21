import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight live-inventory endpoint.
 *
 * Returns a map of `productId -> totalStockedQuantity` computed directly from
 * the inventory tables. The product catalog endpoint (/api/products) is heavy
 * (joins commissions, categories, collections, etc.) and is polled every ~5s,
 * which is fine for catalog meta. This endpoint, by contrast, does only one
 * cheap aggregate query so it can be polled every 2-3s to keep "units
 * available" numbers in sync as sales happen, without re-fetching the entire
 * catalog.
 *
 * Response shape:
 *   { success: true, inventory: { [productId: string]: number }, updatedAt: string }
 */
export async function GET(req: NextRequest) {
    try {
        // Optional ?ids=a,b,c limits the aggregate to the products currently
        // on screen so paginated pages don't pay for the whole catalog.
        const ids = (req.nextUrl.searchParams.get("ids") || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
            .slice(0, 100);
        const result = await pool.query(`
            SELECT
                pv.product_id,
                COALESCE(SUM(il.stocked_quantity), 0)::bigint AS inventory_quantity
            FROM product_variant pv
            JOIN product_variant_inventory_item pvii
                ON pvii.variant_id = pv.id
            LEFT JOIN inventory_level il
                ON il.inventory_item_id = pvii.inventory_item_id
            WHERE pv.deleted_at IS NULL
            ${ids.length ? "AND pv.product_id = ANY($1::text[])" : ""}
            GROUP BY pv.product_id
        `, ids.length ? [ids] : []);

        const inventory: Record<string, number> = {};
        for (const row of result.rows) {
            inventory[row.product_id] = Number(row.inventory_quantity) || 0;
        }

        return NextResponse.json(
            {
                success: true,
                inventory,
                updatedAt: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-store, must-revalidate" },
            }
        );
    } catch (error: any) {
        console.error("Inventory endpoint error:", error?.message || error);
        return NextResponse.json(
            {
                success: false,
                inventory: {},
                error: error?.message || "Failed to load live inventory",
            },
            {
                status: 500,
                headers: { "Cache-Control": "no-store, must-revalidate" },
            }
        );
    }
}
