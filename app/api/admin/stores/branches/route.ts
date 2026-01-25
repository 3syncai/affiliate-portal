import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get unique branches from stores filtered by city
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const city = searchParams.get('city')

        if (!city) {
            return NextResponse.json(
                { success: false, error: 'City parameter is required' },
                { status: 400 }
            )
        }

        const result = await pool.query(
            `SELECT DISTINCT branch_name, id 
       FROM stores 
       WHERE LOWER(city) = LOWER($1) AND is_active = true 
       ORDER BY branch_name ASC`,
            [city]
        )

        const branches = result.rows.map(row => row.branch_name)

        return NextResponse.json({
            success: true,
            branches,
        })
    } catch (error) {
        console.error('Error fetching branches:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch branches' },
            { status: 500 }
        )
    }
}
