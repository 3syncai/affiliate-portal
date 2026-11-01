import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { fetchCommissionRates } from '@/lib/commission-rates'
import { CommissionPoolValidationError } from '@/lib/commission-pool'
import { updateCommissionRates } from '@/lib/commission-rate-update'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

// GET - Get all commission rates
export async function GET() {
    try {
        const commissionRates = await fetchCommissionRates(pool)

        return NextResponse.json({
            success: true,
            rates: commissionRates.rates,
            summary: commissionRates.summary,
            ratesByRole: commissionRates.ratesByRole,
        })
    } catch (error) {
        console.error('Error fetching commission rates:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch commission rates' },
            { status: 500 }
        )
    }
}

// PUT - Update rates atomically; only the normal four-role pool must total 100%.
export async function PUT(request: NextRequest) {
    try {
        let body: unknown
        try { body = await request.json() } catch {
            return NextResponse.json({ success: false, error: 'Invalid JSON request' }, { status: 400 })
        }
        const rates = body && typeof body === 'object' && 'rates' in body ? body.rates : undefined
        await updateCommissionRates(pool, rates)
        return NextResponse.json({ success: true, message: 'Commission rates updated successfully' })
    } catch (error) {
        if (error instanceof CommissionPoolValidationError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 })
        }
        console.error('Error updating commission rates:', error)
        return NextResponse.json({ success: false, error: 'Failed to update commission rates' }, { status: 500 })
    }
}
