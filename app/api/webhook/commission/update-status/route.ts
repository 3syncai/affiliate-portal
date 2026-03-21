import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { normalizeCommissionStatus, isCommissionCreditedStatus } from "@/lib/commission-status";
import { applyAdditionalCommissionForOrder } from "@/lib/additional-commission";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { order_id, status } = payload;
        const normalizedStatus = normalizeCommissionStatus(status);
        const shouldCreditCommission = isCommissionCreditedStatus(status);

        if (!order_id || !status) {
            return NextResponse.json(
                { success: false, message: "Missing order_id or status" },
                { status: 400 }
            );
        }

        console.log(`[Commission Update] Received update for Order #${order_id} -> ${status} (${normalizedStatus})`);

        try {
            await applyAdditionalCommissionForOrder(order_id);
        } catch (additionalError) {
            console.error(`[Additional Commission] Failed before status update for Order #${order_id}:`, additionalError);
        }

        const result = await pool.query(
            `UPDATE affiliate_commission_log 
             SET status = $1,
                 credited_at = CASE
                     WHEN $1 = 'CREDITED' AND credited_at IS NULL THEN NOW()
                     ELSE credited_at
                 END
             WHERE order_id = $2
               AND status IS DISTINCT FROM $1
             RETURNING id, affiliate_code, affiliate_commission`,
            [normalizedStatus, order_id]
        );

        if (result.rowCount === 0) {
            console.log(`[Commission Update] No commissions found for Order #${order_id}`);
            return NextResponse.json({
                success: true,
                message: "No commission records needed an update",
                updated_count: 0
            });
        }

        console.log(`[Commission Update] Updated ${result.rowCount} commission records to ${normalizedStatus}`);

        // Log updated records and Credit Wallet
        for (const row of result.rows) {
            console.log(` - Updated Commission #${row.id}: ₹${row.affiliate_commission} for ${row.affiliate_code}`);

            if (shouldCreditCommission) {
                try {
                    await pool.query(`
                        INSERT INTO customer_wallet (customer_id, coins_balance)
                        SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                        ON CONFLICT (customer_id) 
                        DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                    `, [row.affiliate_code, row.affiliate_commission]);

                    console.log(` - Wallet Credited for ${row.affiliate_code}: +₹${row.affiliate_commission}`);
                } catch (walletError) {
                    console.error(` - Failed to credit wallet for ${row.affiliate_code}:`, walletError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: "Commission status updated successfully",
            updated_count: result.rowCount,
            status: normalizedStatus,
            updated_records: result.rows
        });

    } catch (error: unknown) {
        console.error("Commission status update failed:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
