import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

// POST - Run theme column migration
export async function POST(request: NextRequest) {
    try {
        const results: string[] = []

        // Add theme column to all user tables with role-specific defaults
        const tableDefaults = [
            { table: 'area_sales_manager', defaultTheme: 'blue' },
            { table: 'state_admin', defaultTheme: 'emerald' },
            { table: 'branch_admin', defaultTheme: 'amber' },
            { table: 'affiliate_user', defaultTheme: 'blue' }
        ]

        for (const { table, defaultTheme } of tableDefaults) {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT '${defaultTheme}'`)
                results.push(`✅ Added theme column to ${table} (default: ${defaultTheme})`)
            } catch (error: any) {
                if (error.message.includes('already exists')) {
                    results.push(`ℹ️ Theme column already exists in ${table}`)
                } else {
                    results.push(`❌ Error in ${table}: ${error.message}`)
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Migration completed',
            results
        })

    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// GET - Check migration status
export async function GET(request: NextRequest) {
    try {
        const status: { table: string; hasColumn: boolean }[] = []
        const tables = ['area_sales_manager', 'state_admin', 'branch_admin', 'affiliate_user']

        for (const table of tables) {
            const result = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'theme'
            `, [table])

            status.push({
                table,
                hasColumn: result.rows.length > 0
            })
        }

        const allMigrated = status.every(s => s.hasColumn)

        return NextResponse.json({
            success: true,
            allMigrated,
            status
        })

    } catch (error: any) {
        console.error('Status check error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
