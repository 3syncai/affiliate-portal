import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * High-performance products endpoint for affiliate-facing pages.
 *
 * Why this exists:
 *   The previous implementation proxied to an external Medusa endpoint
 *   (BACKEND_URL/affiliate/user/products) which was taking 30+ seconds per
 *   request. Here we read directly from the Postgres catalog using parallel
 *   aggregate queries and merge in JS — typically under ~200ms cold and
 *   single-digit ms warm (served from the in-memory cache below).
 *
 * Caching:
 *   We keep an in-memory cache of the assembled payload. Within FRESH_MS we
 *   serve it without doing any work. Up to STALE_MS we serve the stale cache
 *   *instantly* and refresh in the background (stale-while-revalidate). Past
 *   STALE_MS, the first request triggers a fresh build and other concurrent
 *   requests piggy-back on the same in-flight promise (request coalescing) so
 *   we never run the heavy query in parallel.
 *
 *   This is per Node process — fine for a small/medium portal. For a fleet of
 *   serverless instances you'd lift this into Redis or Vercel Cache.
 */

interface UserProduct {
    id: string;
    title: string;
    description: string;
    thumbnail: string | null;
    price: number;
    category: string;
    categories: string[];
    collection: string | null;
    isInStock: boolean;
    inventoryQuantity: number;
    commissionRate: number | null;
    commissionSource: string | null;
    commissionAmount: number;
    hasCommission: boolean;
    status: string;
}

interface ProductsPayload {
    success: boolean;
    products: UserProduct[];
    allProducts: UserProduct[];
    categories: string[];
    updatedAt: string;
    builtInMs: number;
}

type CacheEntry = {
    data: ProductsPayload;
    builtAt: number;
};

const FRESH_MS = 30_000;            // serve without revalidating
const STALE_MS = 5 * 60_000;        // serve stale + revalidate in background
const HARD_TIMEOUT_MS = 25_000;     // upper bound on a single rebuild

let cache: CacheEntry | null = null;
let inFlight: Promise<ProductsPayload> | null = null;

async function buildPayload(): Promise<ProductsPayload> {
    const t0 = Date.now();

    // 8 parallel queries — none depend on each other.
    const [
        productsRes,
        variantsRes,
        commissionsRes,
        categoryRes,
        collectionRes,
        inventoryRes,
        priceRes,
    ] = await Promise.all([
        pool.query(`
            SELECT id, title, status, description, thumbnail
            FROM product
            WHERE deleted_at IS NULL
        `),
        pool.query(`
            SELECT id, product_id
            FROM product_variant
            WHERE deleted_at IS NULL
        `),
        pool.query(`
            SELECT product_id, category_id, collection_id, commission_rate
            FROM affiliate_commission
        `),
        pool.query(`
            SELECT
                pcp.product_id,
                pc.id AS category_id,
                pc.name AS category_name
            FROM product_category_product pcp
            JOIN product_category pc ON pc.id = pcp.product_category_id
        `),
        pool.query(`
            SELECT
                p.id AS product_id,
                pc.id AS collection_id,
                pc.title AS collection_title
            FROM product p
            JOIN product_collection pc ON pc.id = p.collection_id
            WHERE p.collection_id IS NOT NULL
        `),
        pool.query(`
            SELECT
                pv.product_id,
                COALESCE(SUM(il.stocked_quantity), 0)::bigint AS inventory_quantity
            FROM product_variant pv
            JOIN product_variant_inventory_item pvii
                ON pvii.variant_id = pv.id
            LEFT JOIN inventory_level il
                ON il.inventory_item_id = pvii.inventory_item_id
            WHERE pv.deleted_at IS NULL
            GROUP BY pv.product_id
        `),
        pool.query(`
            SELECT
                pv.id AS variant_id,
                base_p.amount AS base_price,
                disc_p.amount AS discounted_price
            FROM product_variant pv
            JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
            JOIN price_set ps ON ps.id = pvps.price_set_id
            LEFT JOIN price base_p
                ON base_p.price_set_id = ps.id
                AND base_p.price_list_id IS NULL
                AND base_p.min_quantity IS NULL
                AND base_p.max_quantity IS NULL
            LEFT JOIN price disc_p
                ON disc_p.price_set_id = ps.id
                AND disc_p.price_list_id IS NOT NULL
                AND disc_p.min_quantity IS NULL
                AND disc_p.max_quantity IS NULL
            WHERE pv.deleted_at IS NULL
        `),
    ]);

    // Build lookup maps
    const commissions: Array<{
        product_id: string | null;
        category_id: string | null;
        collection_id: string | null;
        commission_rate: number;
    }> = commissionsRes.rows;

    const productCommission = new Map<string, number>();
    const categoryCommission = new Map<string, number>();
    const collectionCommission = new Map<string, number>();
    for (const c of commissions) {
        const rate = Number(c.commission_rate) || 0;
        if (c.product_id) productCommission.set(c.product_id, rate);
        else if (c.category_id) categoryCommission.set(c.category_id, rate);
        else if (c.collection_id) collectionCommission.set(c.collection_id, rate);
    }

    const productCategories = new Map<string, { ids: Set<string>; names: string[] }>();
    for (const row of categoryRes.rows) {
        const entry = productCategories.get(row.product_id) || { ids: new Set(), names: [] };
        if (!entry.ids.has(row.category_id)) {
            entry.ids.add(row.category_id);
            entry.names.push(row.category_name);
        }
        productCategories.set(row.product_id, entry);
    }

    const productCollections = new Map<string, { id: string; title: string }>();
    for (const row of collectionRes.rows) {
        if (!row.collection_id) continue;
        productCollections.set(row.product_id, {
            id: row.collection_id,
            title: row.collection_title,
        });
    }

    const productInventory = new Map<string, number>();
    for (const row of inventoryRes.rows) {
        productInventory.set(row.product_id, Number(row.inventory_quantity) || 0);
    }

    // Per-variant lowest price (prefer discounted, else base)
    const variantPrice = new Map<string, number>();
    for (const row of priceRes.rows) {
        const disc = row.discounted_price != null ? Number(row.discounted_price) : null;
        const base = row.base_price != null ? Number(row.base_price) : null;
        const price = disc ?? base;
        if (price == null) continue;
        const existing = variantPrice.get(row.variant_id);
        if (existing == null || price < existing) {
            variantPrice.set(row.variant_id, price);
        }
    }

    // Build product -> min price across its variants
    const productPrice = new Map<string, number>();
    for (const v of variantsRes.rows) {
        const p = variantPrice.get(v.id);
        if (p == null) continue;
        const existing = productPrice.get(v.product_id);
        if (existing == null || p < existing) {
            productPrice.set(v.product_id, p);
        }
    }

    // Categories for filter chips (only categories that have at least one
    // commission-eligible published product attached).
    const categoriesSet = new Set<string>();

    const allProducts: UserProduct[] = [];
    const products: UserProduct[] = [];

    for (const p of productsRes.rows) {
        const cats = productCategories.get(p.id);
        const collection = productCollections.get(p.id) || null;

        // Resolve commission rate: product > category > collection
        let rate: number | null = null;
        let source: string | null = null;
        if (productCommission.has(p.id)) {
            rate = productCommission.get(p.id) ?? 0;
            source = "product";
        } else if (cats) {
            for (const catId of cats.ids) {
                if (categoryCommission.has(catId)) {
                    rate = categoryCommission.get(catId) ?? 0;
                    source = "category";
                    break;
                }
            }
        }
        if (rate == null && collection?.id && collectionCommission.has(collection.id)) {
            rate = collectionCommission.get(collection.id) ?? 0;
            source = "collection";
        }

        const price = productPrice.get(p.id) ?? 0;
        const inventoryQuantity = productInventory.get(p.id) ?? 0;
        const hasCommission = rate != null && rate > 0;
        const commissionAmount = hasCommission ? Math.round(price * (rate as number)) / 100 : 0;
        const primaryCategory = cats?.names[0] || "Uncategorized";

        const product: UserProduct = {
            id: p.id,
            title: p.title || "",
            description: p.description || "",
            thumbnail: p.thumbnail || null,
            price,
            category: primaryCategory,
            categories: cats?.names || [],
            collection: collection?.title || null,
            isInStock: inventoryQuantity > 0,
            inventoryQuantity,
            commissionRate: hasCommission ? rate : null,
            commissionSource: source,
            commissionAmount,
            hasCommission,
            status: String(p.status || "published").toLowerCase(),
        };

        allProducts.push(product);

        // Only published + commission-eligible products go in the main list
        if (product.status === "published" && hasCommission) {
            products.push(product);
            if (primaryCategory) categoriesSet.add(primaryCategory);
        }
    }

    // Stable sort: in-stock first, then by title
    products.sort((a, b) => {
        if (a.isInStock !== b.isInStock) return a.isInStock ? -1 : 1;
        return a.title.localeCompare(b.title);
    });

    return {
        success: true,
        products,
        allProducts,
        categories: Array.from(categoriesSet).sort(),
        updatedAt: new Date().toISOString(),
        builtInMs: Date.now() - t0,
    };
}

function startBackgroundRebuild() {
    if (inFlight) return inFlight;
    const timeoutPromise = new Promise<ProductsPayload>((_, reject) => {
        setTimeout(() => reject(new Error("Products rebuild timeout")), HARD_TIMEOUT_MS);
    });
    inFlight = Promise.race([buildPayload(), timeoutPromise])
        .then((data) => {
            cache = { data, builtAt: Date.now() };
            inFlight = null;
            return data;
        })
        .catch((err) => {
            inFlight = null;
            console.error("Products rebuild failed:", err?.message || err);
            throw err;
        });
    return inFlight;
}

async function getCachedOrFresh(): Promise<ProductsPayload> {
    const now = Date.now();

    // Fresh cache — return instantly.
    if (cache && now - cache.builtAt < FRESH_MS) {
        return cache.data;
    }

    // Stale-but-usable cache — return stale instantly, refresh in background.
    if (cache && now - cache.builtAt < STALE_MS) {
        // Fire-and-forget; swallow error since we already have stale data to serve.
        startBackgroundRebuild().catch(() => { });
        return cache.data;
    }

    // No usable cache — wait for a fresh build (coalesced if multiple requests).
    return startBackgroundRebuild();
}

export async function GET(_req: NextRequest) {
    try {
        const data = await getCachedOrFresh();
        const ageMs = cache ? Date.now() - cache.builtAt : 0;
        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "no-store, must-revalidate",
                "X-Cache-Age-Ms": String(ageMs),
                "X-Built-In-Ms": String(data.builtInMs ?? 0),
            },
        });
    } catch (error: any) {
        console.error("Products endpoint error:", error?.message || error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to load products",
                error: error?.message || "Unknown error",
                products: [],
                allProducts: [],
                categories: [],
            },
            {
                status: 500,
                headers: { "Cache-Control": "no-store, must-revalidate" },
            }
        );
    }
}
