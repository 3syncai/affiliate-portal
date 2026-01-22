import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("=== Running Activity Log Enhancement Migration ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false
        });

        // Add new columns
        await pool.query(`
            ALTER TABLE activity_log 
            ADD COLUMN IF NOT EXISTS actor_area VARCHAR(255),
            ADD COLUMN IF NOT EXISTS product_name TEXT,
            ADD COLUMN IF NOT EXISTS product_id TEXT
        `);

        console.log("✅ Added new columns");

        // Add indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_activity_area ON activity_log(actor_area, created_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_activity_state_area ON activity_log(actor_state, actor_area, created_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_activity_full_hierarchy ON activity_log(actor_state, actor_area, actor_branch, created_at DESC)
        `);

        console.log("✅ Added indexes");

        // Add comments
        await pool.query(`
            COMMENT ON COLUMN activity_log.actor_area IS 'City/Area of the ASM (Area Sales Manager) - used for ASM-level filtering'
        `);

        await pool.query(`
            COMMENT ON COLUMN activity_log.product_name IS 'Product name for commission activities'
        `);

        await pool.query(`
            COMMENT ON COLUMN activity_log.product_id IS 'Product ID for commission activities'
        `);

        console.log("✅ Added column comments");

        await pool.end();

        return NextResponse.json({
            success: true,
            message: "Activity log enhancement migration completed successfully",
            changes: [
                "Added actor_area column for ASM hierarchical filtering",
                "Added product_name and product_id columns for commission tracking",
                "Created optimized indexes for hierarchical queries",
                "Added column documentation"
            ]
        });

    } catch (error: any) {
        console.error("Migration failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
}
