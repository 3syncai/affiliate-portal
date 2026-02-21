import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const getSafeErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }
    try {
        return typeof error === "string" ? error : JSON.stringify(error);
    } catch {
        return String(error);
    }
};

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

        console.log(`[Commission Update] Received update for Order #${order_id} -> ${status}`);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const result = await pool.query(
            `UPDATE affiliate_commission_log 
             SET status = $1 
             WHERE order_id = $2
             RETURNING id, affiliate_code, affiliate_commission`,
            [status, order_id]
        );

        if (result.rowCount === 0) {
            console.log(`[Commission Update] No commissions found for Order #${order_id}`);
            return NextResponse.json({
                success: true,
                message: "No commissions found for this order",
                updated_count: 0
            });
        }

        console.log(`[Commission Update] Updated ${result.rowCount} commission records to ${status}`);

        // Log updated records and Credit Wallet
        for (const row of result.rows) {
            console.log(` - Updated Commission #${row.id}: ₹${row.affiliate_commission} for ${row.affiliate_code}`);

            if (status === 'CREDITED' || status === 'COMPLETED') {
                try {
                    await pool.query(`
                        INSERT INTO customer_wallet (customer_id, coins_balance)
                        SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                        ON CONFLICT (customer_id) 
                        DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                    `, [row.affiliate_code, row.affiliate_commission]);

                    console.log(` - Wallet Credited for ${row.affiliate_code}: +₹${row.affiliate_commission}`);
                } catch (walletError) {
                    const safeWalletError = getSafeErrorMessage(walletError);
                    console.error(` - Failed to credit wallet for ${row.affiliate_code}:`, safeWalletError, walletError);
                }
            }
        }


        return NextResponse.json({
            success: true,
            message: "Commission status updated successfully",
            updated_count: result.rowCount,
            updated_records: result.rows
        });

    } catch (error: unknown) {
        const safeMessage = getSafeErrorMessage(error);
        console.error("Commission status update failed:", safeMessage, error);
        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
                error: safeMessage
            },
            { status: 500 }
        );
    }
}
