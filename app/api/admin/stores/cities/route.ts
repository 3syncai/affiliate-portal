import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get unique cities from stores filtered by state
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const state = searchParams.get('state')

        if (!state) {
            return NextResponse.json(
                { success: false, error: 'State parameter is required' },
                { status: 400 }
            )
        }

        const result = await pool.query(
            `SELECT DISTINCT city 
       FROM stores 
       WHERE LOWER(state) = LOWER($1) AND is_active = true 
       ORDER BY city ASC`,
            [state]
        )

        const cities = result.rows.map(row => row.city)

        return NextResponse.json({
            success: true,
            cities,
        })
    } catch (error) {
        console.error('Error fetching cities:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch cities' },
            { status: 500 }
        )
    }
}
