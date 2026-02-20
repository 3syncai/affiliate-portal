import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// GET - Fetch GST settings from database
export async function GET() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Check if app_settings table exists, if not create it
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(255)
      )
    `;
        await pool.query(createTableQuery);

        // Fetch GST percentage
        const query = `
      SELECT setting_value 
      FROM app_settings 
      WHERE setting_key = 'gst_percentage'
    `;
        const result = await pool.query(query);


        const tdsPercentage = result.rows.length > 0
            ? parseFloat(result.rows[0].setting_value)
            : 18; // Default 18%

        return NextResponse.json({
            success: true,
            tdsPercentage
        });
    } catch (error) {
        console.error('Error fetching TDS settings:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch TDS settings'
            },
            { status: 500 }
        );
    }
}

// POST - Save TDS settings to database
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tdsPercentage } = body;

        if (typeof tdsPercentage !== 'number' || tdsPercentage < 0 || tdsPercentage > 100) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid TDS percentage. Must be between 0 and 100'
                },
                { status: 400 }
            );
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // Ensure table exists
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(255)
      )
    `;
        await pool.query(createTableQuery);

        // Insert or update TDS percentage
        // NOTE: We keep 'gst_percentage' as the DB key to avoid migration, but treat it as TDS
        const upsertQuery = `
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('gst_percentage', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = $1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

        await pool.query(upsertQuery, [tdsPercentage.toString()]);

        return NextResponse.json({
            success: true,
            message: 'TDS settings saved successfully to database'
        });
    } catch (error) {
        console.error('Error saving GST settings:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to save GST settings'
            },
            { status: 500 }
        );
    }
}
