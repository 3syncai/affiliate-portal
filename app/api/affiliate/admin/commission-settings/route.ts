import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// GET - Load commission settings
export async function GET() {
    console.log("=== Fetching Commission Settings ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get all commission settings with product/category/collection names
        const result = await pool.query(`
            SELECT 
                ac.id,
                ac.product_id,
                ac.category_id,
                ac.collection_id,
                ac.type_id,
                ac.commission_rate,
                p.title as product_title,
                pc.name as category_name,
                pcol.title as collection_title
            FROM affiliate_commission ac
            LEFT JOIN product p ON p.id = ac.product_id
            LEFT JOIN product_category pc ON pc.id = ac.category_id
            LEFT JOIN product_collection pcol ON pcol.id = ac.collection_id
            ORDER BY ac.id
        `);

        await pool.end();

        // Map to expected format
        const commissions = result.rows.map(row => ({
            id: row.id,
            product_id: row.product_id,
            category_id: row.category_id,
            collection_id: row.collection_id,
            type_id: row.type_id,
            commission_rate: parseFloat(row.commission_rate) || 0,
            product: row.product_id ? { id: row.product_id, title: row.product_title || "Unknown" } : null,
            category: row.category_id ? { id: row.category_id, name: row.category_name || "Unknown" } : null,
            collection: row.collection_id ? { id: row.collection_id, title: row.collection_title || "Unknown" } : null,
            type: row.type_id ? { id: row.type_id, value: "Unknown" } : null
        }));

        console.log(`Found ${commissions.length} commission settings`);
        return NextResponse.json({ success: true, commissions });

    } catch (error: any) {
        console.error("Failed to fetch commission settings:", error.message);
        return NextResponse.json({ success: false, commissions: [], error: error.message }, { status: 500 });
    }
}

// POST - Create new commission setting
export async function POST(req: NextRequest) {
    console.log("=== Creating Commission Setting ===");

    try {
        const body = await req.json();
        const { product_id, category_id, collection_id, type_id, commission_rate } = body;

        console.log("Request body:", body);

        if (commission_rate === undefined || commission_rate === null) {
            return NextResponse.json({ success: false, error: "Commission rate is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Generate unique ID
        const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const result = await pool.query(`
            INSERT INTO affiliate_commission (id, product_id, category_id, collection_id, type_id, commission_rate)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [id, product_id || null, category_id || null, collection_id || null, type_id || null, commission_rate]);

        await pool.end();

        console.log("Created commission:", result.rows[0]);
        return NextResponse.json({ success: true, commission: result.rows[0] });

    } catch (error: any) {
        console.error("Failed to create commission:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
