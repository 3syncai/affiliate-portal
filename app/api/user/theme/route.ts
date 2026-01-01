import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

// GET - Fetch user's theme preference
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const userRole = searchParams.get('userRole')

        if (!userId || !userRole) {
            return NextResponse.json({ success: false, error: 'Missing userId or userRole' }, { status: 400 })
        }

        let tableName = ''
        switch (userRole) {
            case 'asm':
                tableName = 'area_sales_manager'
                break
            case 'state':
                tableName = 'state_admin'
                break
            case 'branch':
                tableName = 'branch_admin'
                break
            case 'affiliate':
                tableName = 'affiliate_user'
                break
            case 'admin':
                tableName = 'admin_users'
                break
            default:
                return NextResponse.json({ success: false, error: 'Invalid user role' }, { status: 400 })
        }

        const result = await pool.query(
            `SELECT theme FROM ${tableName} WHERE id = $1`,
            [userId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ success: true, theme: 'blue' }) // Default theme
        }

        return NextResponse.json({
            success: true,
            theme: result.rows[0].theme || 'blue'
        })

    } catch (error: any) {
        console.error('Error fetching theme:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// POST - Save user's theme preference
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, userRole, theme } = body

        if (!userId || !userRole || !theme) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        // Validate theme
        const validThemes = ['blue', 'emerald', 'violet', 'rose', 'amber', 'slate']
        if (!validThemes.includes(theme)) {
            return NextResponse.json({ success: false, error: 'Invalid theme' }, { status: 400 })
        }

        let tableName = ''
        switch (userRole) {
            case 'asm':
                tableName = 'area_sales_manager'
                break
            case 'state':
                tableName = 'state_admin'
                break
            case 'branch':
                tableName = 'branch_admin'
                break
            case 'affiliate':
                tableName = 'affiliate_user'
                break
            case 'admin':
                tableName = 'admin_users'
                break
            default:
                return NextResponse.json({ success: false, error: 'Invalid user role' }, { status: 400 })
        }

        // First, check if the theme column exists, if not add it
        try {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'blue'`)
        } catch (alterError) {
            // Column might already exist, continue
            console.log('Theme column may already exist')
        }

        // For admin_users, use upsert since admin may not exist in local table yet
        if (userRole === 'admin') {
            await pool.query(
                `INSERT INTO admin_users (id, theme) VALUES ($1, $2)
                 ON CONFLICT (id) DO UPDATE SET theme = $2, updated_at = CURRENT_TIMESTAMP`,
                [userId, theme]
            )
        } else {
            await pool.query(
                `UPDATE ${tableName} SET theme = $1 WHERE id = $2`,
                [theme, userId]
            )
        }

        return NextResponse.json({ success: true, message: 'Theme saved successfully' })

    } catch (error: any) {
        console.error('Error saving theme:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
