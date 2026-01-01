import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// POST - Add affiliate commission rate to database
export async function POST() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Add affiliate role to commission_rates if it doesn't exist
        await pool.query(`
            INSERT INTO commission_rates (role_type, commission_percentage, description) 
            VALUES ('affiliate', 70.00, 'Commission percentage that affiliate agents receive from their product commission')
            ON CONFLICT (role_type) DO NOTHING
        `);

        await pool.end();

        return NextResponse.json({
            success: true,
            message: "Affiliate commission rate added successfully"
        });
    } catch (error: any) {
        console.error("Failed to add affiliate commission:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
