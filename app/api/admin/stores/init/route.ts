import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

export async function GET(request: NextRequest) {
    try {
        // Create stores table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stores (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                branch_name VARCHAR(255) NOT NULL,
                city VARCHAR(100) NOT NULL,
                state VARCHAR(100) NOT NULL,
                address TEXT,
                contact_phone VARCHAR(20),
                contact_email VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_stores_state ON stores(state)`)
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city)`)
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_stores_branch_name ON stores(branch_name)`)
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active)`)

        // Create update trigger function
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_stores_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `)

        // Create or replace trigger
        await pool.query(`DROP TRIGGER IF EXISTS stores_updated_at_trigger ON stores`)
        await pool.query(`
            CREATE TRIGGER stores_updated_at_trigger
                BEFORE UPDATE ON stores
                FOR EACH ROW
                EXECUTE FUNCTION update_stores_updated_at()
        `)

        // Check if table exists
        const checkTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'stores'
            )
        `)

        return NextResponse.json({
            success: true,
            message: 'Stores table initialized successfully',
            tableExists: checkTable.rows[0].exists
        })
    } catch (error: any) {
        console.error('Error initializing stores table:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
