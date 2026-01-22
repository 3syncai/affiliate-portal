import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { productId, commission } = body

        if (!productId || commission === undefined || commission === null) {
            return NextResponse.json(
                { success: false, message: "Product ID and commission are required" },
                { status: 400 }
            )
        }

        if (commission < 0 || commission > 100) {
            return NextResponse.json(
                { success: false, message: "Commission must be between 0 and 100" },
                { status: 400 }
            )
        }

        // Update product commission in database
        // This will override any category or collection commission
        const updateQuery = `
            INSERT INTO product_commissions (product_id, commission_percentage, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (product_id) 
            DO UPDATE SET 
                commission_percentage = $2,
                updated_at = NOW()
        `

        await pool.query(updateQuery, [productId, commission])

        return NextResponse.json({
            success: true,
            message: "Product commission updated successfully. This overrides any category or collection commission.",
            data: {
                productId,
                commission
            }
        })
    } catch (error: any) {
        console.error("Error updating product commission:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        )
    }
}

