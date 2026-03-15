import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get admin statistics
export async function GET() {
    try {
        // Get counts for each admin type
        const stateAdminCount = await pool.query('SELECT COUNT(*) FROM state_admin WHERE is_active = true')
        const areaManagerCount = await pool.query('SELECT COUNT(*) FROM area_sales_manager WHERE is_active = true')
        const branchAdminCount = await pool.query('SELECT COUNT(*) FROM branch_admin WHERE is_active = true')

        return NextResponse.json({
            success: true,
            stats: {
                stateAdmins: parseInt(stateAdminCount.rows[0].count),
                areaManagers: parseInt(areaManagerCount.rows[0].count),
                branchAdmins: parseInt(branchAdminCount.rows[0].count),
            },
        })
    } catch (error) {
        console.error('Error fetching admin stats:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch admin statistics' },
            { status: 500 }
        )
    }
}
