import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get unique states from stores
export async function GET() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT state 
       FROM stores 
       WHERE is_active = true 
       ORDER BY state ASC`
        )

        const states = result.rows.map(row => row.state)

        return NextResponse.json({
            success: true,
            states,
        })
    } catch (error) {
        console.error('Error fetching states:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch states' },
            { status: 500 }
        )
    }
}
