import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { applyAdditionalCommissionForOrder } from "@/lib/additional-commission";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { order_id, status } = payload;

        if (!order_id || !status) {
            return NextResponse.json(
                { success: false, message: "Missing order_id or status" },
                { status: 400 }
            );
        }

        console.log(
            `[Commission Update] Received update for Order #${order_id} -> ${status} (ledger stays PENDING until unlock)`,
        );

        try {
            await applyAdditionalCommissionForOrder(order_id);
        } catch (additionalError) {
            console.error(`[Additional Commission] Failed before status update for Order #${order_id}:`, additionalError);
        }

        const result = await pool.query(
            `UPDATE affiliate_commission_log 
             SET status = 'PENDING',
                 credited_at = NULL
             WHERE order_id = $1
               AND status IS DISTINCT FROM 'CANCELLED'
             RETURNING id, affiliate_code, affiliate_commission, status, unlock_at`,
            [order_id]
        );

        if (result.rowCount === 0) {
            console.log(`[Commission Update] No commissions found for Order #${order_id}`);
            return NextResponse.json({
                success: true,
                message: "No commission records needed an update",
                updated_count: 0
            });
        }

        await syncAffiliateCommissionStatuses(pool, {
            logPrefix: "[Commission Update]",
        });

        for (const row of result.rows) {
            console.log(
                ` - Commission #${row.id}: ₹${row.affiliate_commission} for ${row.affiliate_code} ` +
                `status=${row.status}` +
                (row.unlock_at ? `, unlock_at=${row.unlock_at}` : "")
            );
        }

        return NextResponse.json({
            success: true,
            message: "Commission status updated; unlock window managed by sync",
            updated_count: result.rowCount,
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
