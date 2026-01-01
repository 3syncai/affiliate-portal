import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get a single store by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params

        const result = await pool.query('SELECT * FROM stores WHERE id = $1', [id])

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Store not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            store: result.rows[0],
        })
    } catch (error) {
        console.error('Error fetching store:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch store' },
            { status: 500 }
        )
    }
}

// PUT - Update a store
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const body = await request.json()
        const { branch_name, city, state, address, contact_phone, contact_email, is_active } = body

        // Validation
        if (!branch_name || !city || !state) {
            return NextResponse.json(
                { success: false, error: 'Branch name, city, and state are required' },
                { status: 400 }
            )
        }

        const result = await pool.query(
            `UPDATE stores 
       SET branch_name = $1, city = $2, state = $3, address = $4, 
           contact_phone = $5, contact_email = $6, is_active = $7
       WHERE id = $8
       RETURNING *`,
            [
                branch_name,
                city,
                state,
                address || null,
                contact_phone || null,
                contact_email || null,
                is_active !== undefined ? is_active : true,
                id,
            ]
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Store not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            store: result.rows[0],
            message: 'Store updated successfully',
        })
    } catch (error) {
        console.error('Error updating store:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update store' },
            { status: 500 }
        )
    }
}

// DELETE - Delete/deactivate a store
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params

        // Soft delete by setting is_active to false
        const result = await pool.query(
            'UPDATE stores SET is_active = false WHERE id = $1 RETURNING *',
            [id]
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Store not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Store deactivated successfully',
        })
    } catch (error) {
        console.error('Error deleting store:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete store' },
            { status: 500 }
        )
    }
}
