import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import {
    ensureStoresPincodeSchema,
    validateStorePincode,
} from '@/lib/stores-schema'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

// GET - Fetch all stores
export async function GET(request: NextRequest) {
    try {
        await ensureStoresPincodeSchema()

        const result = await pool.query(`
            SELECT 
                id,
                branch_name,
                city,
                state,
                pincode,
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
    } catch (error: any) {
        console.error('Error fetching stores:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// POST - Create a new store
export async function POST(request: NextRequest) {
    try {
        await ensureStoresPincodeSchema()

        const body = await request.json()
        const {
            branch_name,
            city,
            state,
            address,
            contact_phone,
            contact_email,
            pincode,
        } = body

        // Validation
        if (!branch_name || !city || !state) {
            return NextResponse.json(
                { success: false, error: 'Branch name, city, and state are required' },
                { status: 400 }
            )
        }

        const normalizedPincode = validateStorePincode(pincode)
        if (pincode !== undefined && pincode !== null && pincode !== "" && !normalizedPincode) {
            return NextResponse.json(
                { success: false, error: 'Pincode must be exactly 6 digits' },
                { status: 400 }
            )
        }

        const result = await pool.query(
            `INSERT INTO stores (
                branch_name, 
                city, 
                state,
                pincode,
                address, 
                contact_phone, 
                contact_email,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING *`,
            [
                branch_name,
                city,
                state,
                normalizedPincode,
                address || null,
                contact_phone || null,
                contact_email || null,
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'Store created successfully',
            store: result.rows[0]
        })
    } catch (error: any) {
        console.error('Error creating store:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
