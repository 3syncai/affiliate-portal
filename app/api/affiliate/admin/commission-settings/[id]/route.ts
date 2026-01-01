import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// PUT - Update commission rate
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log("=== Updating Commission Setting ===", id);

    try {
        const body = await req.json();
        const { commission_rate } = body;

        if (commission_rate === undefined || commission_rate === null) {
            return NextResponse.json({ success: false, error: "Commission rate is required" }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(`
            UPDATE affiliate_commission 
            SET commission_rate = $1
            WHERE id = $2
            RETURNING *
        `, [commission_rate, id]);

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Commission not found" }, { status: 404 });
        }

        console.log("Updated commission:", result.rows[0]);
        return NextResponse.json({ success: true, commission: result.rows[0] });

    } catch (error: any) {
        console.error("Failed to update commission:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE - Delete commission
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log("=== Deleting Commission Setting ===", id);

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(`
            DELETE FROM affiliate_commission 
            WHERE id = $1
            RETURNING *
        `, [id]);

        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, error: "Commission not found" }, { status: 404 });
        }

        console.log("Deleted commission:", result.rows[0]);
        return NextResponse.json({ success: true, message: "Commission deleted" });

    } catch (error: any) {
        console.error("Failed to delete commission:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
