import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// POST /api/admin/run-migration
// Runs the migration to add affiliate_rate and affiliate_commission columns
export async function POST() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Add the new columns
        await pool.query(`
            ALTER TABLE affiliate_commission_log 
            ADD COLUMN IF NOT EXISTS affiliate_rate DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS affiliate_commission DECIMAL(10,2)
        `);

        // Get current affiliate rate
        const rateResult = await pool.query(`
            SELECT commission_percentage 
            FROM commission_rates 
            WHERE role_type = 'affiliate'
        `);
        const affiliateRate = rateResult.rows.length > 0
            ? parseFloat(rateResult.rows[0].commission_percentage)
            : 100; // Default to 100% if not set

        // Update existing records with current rate
        await pool.query(`
            UPDATE affiliate_commission_log 
            SET affiliate_rate = $1,
                affiliate_commission = commission_amount * $1 / 100
            WHERE affiliate_commission IS NULL
        `, [affiliateRate]);


        return NextResponse.json({
            success: true,
            message: "Migration completed successfully",
            affiliateRateApplied: affiliateRate
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Migration failed:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
