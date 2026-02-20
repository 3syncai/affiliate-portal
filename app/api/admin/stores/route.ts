import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

// GET - Fetch all stores
export async function GET() {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                branch_name,
                city,
                state,
                address,
                contact_phone,
                contact_email,
                is_active,
                created_at,
                updated_at
            FROM stores
            ORDER BY created_at DESC
        `)

        return NextResponse.json({
            success: true,
            stores: result.rows
        })
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error fetching stores:', err)
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        )
    }
}

// POST - Create a new store
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { branch_name, city, state, address, contact_phone, contact_email } = body

        // Validation
        if (!branch_name || !city || !state) {
            return NextResponse.json(
                { success: false, error: 'Branch name, city, and state are required' },
                { status: 400 }
            )
        }

        const result = await pool.query(
            `INSERT INTO stores (
                branch_name, 
                city, 
                state, 
                address, 
                contact_phone, 
                contact_email,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING *`,
            [branch_name, city, state, address || null, contact_phone || null, contact_email || null]
        )

        return NextResponse.json({
            success: true,
            message: 'Store created successfully',
            store: result.rows[0]
        })
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error creating store:', err)
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        )
    }
}
