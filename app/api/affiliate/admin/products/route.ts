import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

interface MedusaProduct {
    id: string;
    title: string;
    handle: string;
    status: string;
    description: string;
    thumbnail: string;
    images: { url: string }[];
    variants: MedusaVariant[];
    type: { id: string; value: string };
    tags: { id: string; value: string }[];
    created_at: string;
    updated_at: string;
}

interface MedusaVariant {
    id: string;
    title: string;
    sku: string;
    inventory_quantity: number;
    prices: { amount: number; currency_code: string }[];
}

interface DBCommission {
    id: string;
    product_id: string | null;
    category_id: string | null;
    collection_id: string | null;
    commission_rate: number;
}

interface DBCategory {
    product_id: string;
    category_id: string;
    category_name: string;
    category_handle: string;
}

interface DBCollection {
    product_id: string;
    collection_id: string;
    collection_title: string;
    collection_handle: string;
}

interface DBInventory {
    variant_id: string;
    inventory_quantity: string;
}

interface DBPrice {
    variant_id: string;
    base_price: string;
    discounted_price: string | null;
}

export async function GET(req: NextRequest) {
    console.log("=== Fetching Products for Admin (Optimized) ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Execute all queries concurrently to drastically reduce load time
        const [
            productsRes,
            variantsRes,
            commissionsRes,
            categoryRes,
            collectionRes,
            inventoryRes,
            priceRes,
            typesRes
        ] = await Promise.all([
            pool.query(`SELECT id, title, handle, status, description, thumbnail, type_id, created_at, updated_at FROM product WHERE deleted_at IS NULL LIMIT 25000`),
            pool.query(`SELECT id, product_id, title, sku FROM product_variant WHERE deleted_at IS NULL`),
            pool.query(`SELECT * FROM affiliate_commission`),
            pool.query(`
                SELECT 
                    pcp.product_id,
                    pc.id as category_id,
                    pc.name as category_name,
                    pc.handle as category_handle
                FROM product_category_product pcp
                JOIN product_category pc ON pc.id = pcp.product_category_id
            `),
            pool.query(`
                SELECT 
                    p.id as product_id,
                    pc.id as collection_id,
                    pc.title as collection_title,
                    pc.handle as collection_handle
                FROM product p
                JOIN product_collection pc ON pc.id = p.collection_id
                WHERE p.collection_id IS NOT NULL
            `),
            pool.query(`
                SELECT 
                    pvii.variant_id,
                    COALESCE(SUM(il.stocked_quantity), 0) as inventory_quantity
                FROM product_variant_inventory_item pvii
                LEFT JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
                GROUP BY pvii.variant_id
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
            pool.query(`SELECT id, value FROM product_type WHERE deleted_at IS NULL`)
        ]);

        console.log(`Loaded ${productsRes.rows.length} products directly from database.`);

        const commissions = commissionsRes.rows;
        
        const productCategories = new Map<string, any[]>();
        categoryRes.rows.forEach(row => {
            const existing = productCategories.get(row.product_id) || [];
            existing.push({ id: row.category_id, name: row.category_name, handle: row.category_handle });
            productCategories.set(row.product_id, existing);
        });

        const productCollections = new Map<string, any>();
        collectionRes.rows.forEach(row => {
            productCollections.set(row.product_id, {
                id: row.collection_id, title: row.collection_title, handle: row.collection_handle
            });
        });

        const variantInventory = new Map<string, number>();
        inventoryRes.rows.forEach(row => {
            variantInventory.set(row.variant_id, parseInt(row.inventory_quantity) || 0);
        });

        const variantPrices = new Map<string, { base_price: number, discounted_price: number | null }>();
        priceRes.rows.forEach(row => {
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

        const typesMap = new Map<string, any>();
        typesRes.rows.forEach(row => {
            typesMap.set(row.id, { id: row.id, value: row.value });
        });

        const productVariants = new Map<string, any[]>();
        variantsRes.rows.forEach(v => {
            const invQty = variantInventory.get(v.id) || 0;
            const dbPrices = variantPrices.get(v.id);
            const basePrice = dbPrices?.base_price || 0;
            const discountedPrice = dbPrices?.discounted_price || null;
            const currentPrice = discountedPrice || basePrice;

            const variant = {
                id: v.id,
                title: v.title || "Default",
                sku: v.sku || "",
                inventory_quantity: invQty,
                price: currentPrice,
                original_price: discountedPrice ? basePrice : null
            };

            const existing = productVariants.get(v.product_id) || [];
            existing.push(variant);
            productVariants.set(v.product_id, existing);
        });

        // Map final products
        const products = productsRes.rows.map(product => {
            const categories = productCategories.get(product.id) || [];
            const collection = productCollections.get(product.id) || null;
            const type = product.type_id ? typesMap.get(product.type_id) : null;
            const variants = productVariants.get(product.id) || [];
            const totalInventory = variants.reduce((sum: number, v: any) => sum + v.inventory_quantity, 0);

            let commission = 0;
            const productCommission = commissions.find((c: DBCommission) => c.product_id === product.id);
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

            return {
                id: product.id,
                title: product.title,
                handle: product.handle,
                status: product.status || "published",
                description: product.description,
                thumbnail: product.thumbnail,
                images: [], // Images are not typically required for this list view, optimize by skipping
                categories: categories.map((cat: any) => ({
                    ...cat,
                    commission: commissions.find((c: any) => c.category_id === cat.id)?.commission_rate || 0
                })),
                collection: collection ? {
                    ...collection,
                    commission: commissions.find((c: any) => c.collection_id === collection.id)?.commission_rate || 0
                } : null,
                type: type,
                tags: [],
                variants,
                total_inventory: totalInventory,
                in_stock: totalInventory > 0,
                commission,
                created_at: product.created_at,
                updated_at: product.updated_at
            };
        });

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
            success: false,
            products: [],
            filters: { categories: [], collections: [], types: [] },
            stats: { total: 0, in_stock: 0, out_of_stock: 0 }
        });
    }
}
