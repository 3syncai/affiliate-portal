import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

export async function GET() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (branch_name)
                branch_name,
                state,
                city
             FROM stores
             WHERE COALESCE(is_active, true) = true
             ORDER BY branch_name ASC, created_at DESC`
        )

        const branches = result.rows.map((row) => ({
            branch_name: row.branch_name,
            state: row.state,
            city: row.city,
        }))

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
