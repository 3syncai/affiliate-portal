import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get all commission rates
export async function GET() {
    try {
        const result = await pool.query(
            `SELECT id, role_type, commission_percentage, description, updated_at
       FROM commission_rates 
       ORDER BY 
         CASE role_type
           WHEN 'affiliate' THEN 1
           WHEN 'state' THEN 2
           WHEN 'area' THEN 3
           WHEN 'branch' THEN 4
         END`
        )

        return NextResponse.json({
            success: true,
            rates: result.rows,
        })
    } catch (error) {
        console.error('Error fetching commission rates:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch commission rates' },
            { status: 500 }
        )
    }
}

// PUT - Update commission rates
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { rates } = body

        if (!rates || !Array.isArray(rates)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request format' },
                { status: 400 }
            )
        }

        // Validate all rates
        for (const rate of rates) {
            if (!rate.role_type || rate.commission_percentage === undefined) {
                return NextResponse.json(
                    { success: false, error: 'Missing required fields' },
                    { status: 400 }
                )
            }

            const percentage = parseFloat(rate.commission_percentage)
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                return NextResponse.json(
                    { success: false, error: 'Commission percentage must be between 0 and 100' },
                    { status: 400 }
                )
            }
        }

        // Update each rate
        const client = await pool.connect()
        try {
            await client.query('BEGIN')

            for (const rate of rates) {
                await client.query(
                    `UPDATE commission_rates 
           SET commission_percentage = $1 
           WHERE role_type = $2`,
                    [rate.commission_percentage, rate.role_type]
                )
            }

            await client.query('COMMIT')

            return NextResponse.json({
                success: true,
                message: 'Commission rates updated successfully',
            })
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    } catch (error) {
        console.error('Error updating commission rates:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update commission rates' },
            { status: 500 }
        )
    }
}
