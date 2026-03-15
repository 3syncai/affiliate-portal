import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

export async function GET() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT branch_name 
             FROM stores 
             WHERE is_active = true 
             ORDER BY branch_name ASC`
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
