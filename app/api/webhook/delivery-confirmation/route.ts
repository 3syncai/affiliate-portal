import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

interface DeliveryConfirmationPayload {
    order_id: string;
}

// POST /api/webhook/delivery-confirmation
// Called when order is delivered to credit pending commissions to affiliate wallet
export async function POST(request: NextRequest) {
    try {
        const payload: DeliveryConfirmationPayload = await request.json();

        if (!payload.order_id) {
            return NextResponse.json({
                success: false,
                error: "Missing required field: order_id"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false
        });

        // Get pending commissions for this order
        const commissionsResult = await pool.query(`
            SELECT 
                id,
                affiliate_code,
                affiliate_commission,
                status
            FROM affiliate_commission_log
            WHERE order_id = $1 AND status = 'PENDING'
        `, [payload.order_id]);

        if (commissionsResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json({
                success: true,
                message: "No pending commissions found for this order"
            });
        }

        const updatedCommissions = [];

        for (const commission of commissionsResult.rows) {
            // Update commission status to CREDITED
            await pool.query(`
                UPDATE affiliate_commission_log
                SET status = 'CREDITED', updated_at = NOW()
                WHERE id = $1
            `, [commission.id]);

            // Now credit the wallet
            await pool.query(`
                INSERT INTO customer_wallet (customer_id, coins_balance)
                SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                ON CONFLICT (customer_id) 
                DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `, [commission.affiliate_code, commission.affiliate_commission]);

            updatedCommissions.push({
                commission_id: commission.id,
                affiliate_code: commission.affiliate_code,
                amount: commission.affiliate_commission
            });

            console.log(`✅ Credited ${commission.affiliate_commission} to affiliate ${commission.affiliate_code} for delivered order ${payload.order_id}`);
        }

        await pool.end();

        return NextResponse.json({
            success: true,
            message: `Credited ${updatedCommissions.length} commission(s) after delivery`,
            credited: updatedCommissions
        });

    } catch (error: any) {
        console.error("Delivery confirmation failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
