import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { BACKEND_URL, MEDUSA_PUBLISHABLE_KEY } from "@/lib/config";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching Products for Admin ===");

    // Headers for Medusa store API
    const storeHeaders = {
        "Content-Type": "application/json",
        ...(MEDUSA_PUBLISHABLE_KEY && { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY })
    };

    try {
        // Fetch products from Medusa API
        let rawProducts: any[] = [];

        try {
            console.log("Trying /store/products with expanded fields...");
            const response = await axios.get(`${BACKEND_URL}/store/products`, {
                headers: storeHeaders,
                params: {
                    limit: 10000,
                    fields: "+categories,+collection,+variants.inventory_quantity,*variants,*variants.prices"
                }
            });
            rawProducts = response.data?.products || [];
            console.log(`Store products endpoint returned ${rawProducts.length} products`);
        } catch (e: any) {
            console.log("Store products endpoint failed:", e.message);
        }

        // Try flash sale as fallback
        if (rawProducts.length === 0) {
            try {
                console.log("Trying /store/flash-sale/products...");
                const response = await axios.get(`${BACKEND_URL}/store/flash-sale/products`, {
                    headers: storeHeaders,
                    params: { limit: 10000 }
                });
                rawProducts = response.data?.products || [];
                console.log(`Flash sale endpoint returned ${rawProducts.length} products`);
            } catch (e: any) {
                console.log("Flash sale endpoint failed:", e.message);
            }
        }

        if (rawProducts.length === 0) {
            return NextResponse.json({
                success: true,
                products: [],
                filters: { categories: [], collections: [], types: [] },
                stats: { total: 0, in_stock: 0, out_of_stock: 0 }
            });
        }

        // Connect to database to get category, collection, and inventory data
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get commissions from affiliate_commission table
        let commissions: any[] = [];
        try {
            const commissionsResult = await pool.query(`SELECT * FROM affiliate_commission`);
            commissions = commissionsResult.rows;
            console.log(`Found ${commissions.length} commissions`);
        } catch (dbError: any) {
            console.log("Could not fetch commissions:", dbError.message);
        }

        // Get product categories from database
        let productCategories: Map<string, any[]> = new Map();
        try {
            const categoryResult = await pool.query(`
                SELECT 
                    pcp.product_id,
                    pc.id as category_id,
                    pc.name as category_name,
                    pc.handle as category_handle
                FROM product_category_product pcp
                JOIN product_category pc ON pc.id = pcp.product_category_id
            `);
            categoryResult.rows.forEach((row: any) => {
                const existing = productCategories.get(row.product_id) || [];
                existing.push({
                    id: row.category_id,
                    name: row.category_name,
                    handle: row.category_handle
                });
                productCategories.set(row.product_id, existing);
            });
            console.log(`Found categories for ${productCategories.size} products`);
        } catch (e: any) {
            console.log("Could not fetch product categories:", e.message);
        }

        // Get collections from database
        let productCollections: Map<string, any> = new Map();
        try {
            const collectionResult = await pool.query(`
                SELECT 
                    p.id as product_id,
                    pc.id as collection_id,
                    pc.title as collection_title,
                    pc.handle as collection_handle
                FROM product p
                JOIN product_collection pc ON pc.id = p.collection_id
                WHERE p.collection_id IS NOT NULL
            `);
            collectionResult.rows.forEach((row: any) => {
                productCollections.set(row.product_id, {
                    id: row.collection_id,
                    title: row.collection_title,
                    handle: row.collection_handle
                });
            });
            console.log(`Found collections for ${productCollections.size} products`);
        } catch (e: any) {
            console.log("Could not fetch product collections:", e.message);
        }

        // Get inventory from database
        let variantInventory: Map<string, number> = new Map();
        try {
            const inventoryResult = await pool.query(`
                SELECT 
                    pvii.variant_id,
                    COALESCE(SUM(il.stocked_quantity), 0) as inventory_quantity
                FROM product_variant_inventory_item pvii
                LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
                GROUP BY pvii.variant_id
            `);
            inventoryResult.rows.forEach((row: any) => {
                variantInventory.set(row.variant_id, parseInt(row.inventory_quantity) || 0);
            });
            console.log(`Found inventory for ${variantInventory.size} variants`);
        } catch (e: any) {
            console.log("Could not fetch variant inventory:", e.message);
        }

        // Get variant prices from database (base price and discounted price)
        let variantPrices: Map<string, { base_price: number, discounted_price: number | null }> = new Map();
        try {
            const priceResult = await pool.query(`
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
            `);
            priceResult.rows.forEach((row: any) => {
                // Store both prices, keep existing if there's already one (to get the sale price)
                const existing = variantPrices.get(row.variant_id);
                if (!existing) {
                    variantPrices.set(row.variant_id, {
                        base_price: parseFloat(row.base_price) || 0,
                        discounted_price: row.discounted_price ? parseFloat(row.discounted_price) : null
                    });
                } else if (row.discounted_price && !existing.discounted_price) {
                    existing.discounted_price = parseFloat(row.discounted_price);
                }
            });
            console.log(`Found prices for ${variantPrices.size} variants`);
        } catch (e: any) {
            console.log("Could not fetch variant prices:", e.message);
        }

        await pool.end();

        // Map products with enriched data
        const products = rawProducts.map((product: any) => {
            // Get categories from database
            const categories = productCategories.get(product.id) || [];

            // Get collection from database
            const collection = productCollections.get(product.id) || null;

            // Get commission
            let commission = 0;
            const productCommission = commissions.find((c: any) => c.product_id === product.id);
            if (productCommission) {
                commission = productCommission.commission_rate;
            } else if (categories.length > 0) {
                const categoryCommission = commissions.find((c: any) =>
                    categories.some((cat: any) => cat.id === c.category_id)
                );
                if (categoryCommission) commission = categoryCommission.commission_rate;
            } else if (collection) {
                const collectionCommission = commissions.find((c: any) => c.collection_id === collection.id);
                if (collectionCommission) commission = collectionCommission.commission_rate;
            }

            // Process variants with inventory and prices from database
            const variants = (product.variants || []).map((v: any) => {
                const invQty = variantInventory.get(v.id) || v.inventory_quantity || 0;

                // Get prices from database (already in correct format, no /100)
                const dbPrices = variantPrices.get(v.id);
                const basePrice = dbPrices?.base_price || 0;
                const discountedPrice = dbPrices?.discounted_price || null;

                // Use discounted price if available, otherwise base price
                const currentPrice = discountedPrice || basePrice;

                return {
                    id: v.id,
                    title: v.title || "Default",
                    sku: v.sku || "",
                    inventory_quantity: invQty,
                    price: currentPrice,
                    original_price: discountedPrice ? basePrice : null // Show original only if there's a discount
                };
            });

            const totalInventory = variants.reduce((sum: number, v: any) => sum + v.inventory_quantity, 0);

            return {
                id: product.id,
                title: product.title,
                handle: product.handle,
                status: product.status || "published",
                description: product.description,
                thumbnail: product.thumbnail,
                images: product.images || [],
                categories: categories.map((cat: any) => ({
                    ...cat,
                    commission: commissions.find((c: any) => c.category_id === cat.id)?.commission_rate || 0
                })),
                collection: collection ? {
                    ...collection,
                    commission: commissions.find((c: any) => c.collection_id === collection.id)?.commission_rate || 0
                } : null,
                type: product.type,
                tags: product.tags || [],
                variants,
                total_inventory: totalInventory,
                in_stock: totalInventory > 0,
                commission,
                created_at: product.created_at,
                updated_at: product.updated_at
            };
        });

        // Build filters
        const categoryMap = new Map();
        const collectionMap = new Map();
        const typeMap = new Map();

        products.forEach((p: any) => {
            p.categories?.forEach((cat: any) => {
                if (cat.id && !categoryMap.has(cat.id)) categoryMap.set(cat.id, cat);
            });
            if (p.collection && p.collection.id && !collectionMap.has(p.collection.id)) {
                collectionMap.set(p.collection.id, p.collection);
            }
            if (p.type && p.type.id && !typeMap.has(p.type.id)) {
                typeMap.set(p.type.id, p.type);
            }
        });

        const stats = {
            total: products.length,
            in_stock: products.filter((p: any) => p.in_stock).length,
            out_of_stock: products.filter((p: any) => !p.in_stock).length
        };

        console.log(`Returning ${products.length} products with ${categoryMap.size} categories and ${collectionMap.size} collections`);

        return NextResponse.json({
            success: true,
            products,
            filters: {
                categories: Array.from(categoryMap.values()),
                collections: Array.from(collectionMap.values()),
                types: Array.from(typeMap.values())
            },
            stats
        });
    } catch (error: any) {
        console.error("Failed to fetch products:", error.message);

        return NextResponse.json({
            success: true,
            products: [],
            filters: { categories: [], collections: [], types: [] },
            stats: { total: 0, in_stock: 0, out_of_stock: 0 }
        });
    }
}
