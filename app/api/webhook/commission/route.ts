import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

interface CommissionPayload {
    order_id: string;
    affiliate_code: string;
    product_name: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    commission_rate: number;
    commission_amount: number;  // Full commission before affiliate cut
    commission_source: string;
    status?: string;
    customer_id?: string;
    customer_name?: string;  // NEW: Customer display name
    customer_email?: string; // NEW: Customer email address
}

// POST /api/webhook/commission
// Records affiliate commission with proper affiliate rate deduction
export async function POST(request: NextRequest) {
    try {
        const payload: CommissionPayload = await request.json();

        // Validate required fields
        if (!payload.order_id || !payload.affiliate_code || !payload.commission_amount) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: order_id, affiliate_code, commission_amount"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get current affiliate rate
        const rateResult = await pool.query(`
            SELECT commission_percentage 
            FROM commission_rates 
            WHERE role_type = 'affiliate'
        `);
        const affiliateRate = rateResult.rows.length > 0
            ? parseFloat(rateResult.rows[0].commission_percentage)
            : 100; // Default to 100% if not set

        // Calculate affiliate's actual commission
        const affiliateCommission = payload.commission_amount * (affiliateRate / 100);

        // Insert commission log with affiliate rate applied
        const insertResult = await pool.query(`
            INSERT INTO affiliate_commission_log (
                order_id,
                affiliate_code,
                product_name,
                quantity,
                item_price,
                order_amount,
                commission_rate,
                commission_amount,
                affiliate_rate,
                affiliate_commission,
                commission_source,
                status,
                customer_id,
                customer_name,
                customer_email,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            RETURNING id
        `, [
            payload.order_id,
            payload.affiliate_code,
            payload.product_name || 'Product',
            payload.quantity || 1,
            payload.item_price || 0,
            payload.order_amount || 0,
            payload.commission_rate || 0,
            payload.commission_amount,  // Full commission
            affiliateRate,              // Rate at time of order
            affiliateCommission,        // Affiliate's actual earnings
            payload.commission_source || 'order',
            payload.status || 'CREDITED',
            payload.customer_id || null,
            payload.customer_name || null,
            payload.customer_email || null
        ]);

        // Update customer wallet with affiliateCommission (not full amount)
        await pool.query(`
            INSERT INTO customer_wallet (customer_id, coins_balance)
            SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
            ON CONFLICT (customer_id) 
            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
        `, [payload.affiliate_code, affiliateCommission]);

        await pool.end();

        return NextResponse.json({
            success: true,
            data: {
                id: insertResult.rows[0].id,
                fullCommission: payload.commission_amount,
                affiliateRate: affiliateRate,
                affiliateCommission: affiliateCommission,
                platformFee: payload.commission_amount - affiliateCommission
            }
        });

    } catch (error: any) {
        console.error("Commission recording failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
