import { NextRequest } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { clients } from "@/lib/sse";

// Store connected clients (Moved to lib/sse.ts)
// const clients = new Map<string, ReadableStreamDefaultController>();

// SSE endpoint for real-time notifications
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const affiliateCode = searchParams.get("affiliate_code");

    if (!affiliateCode) {
        return new Response("affiliate_code required", { status: 400 });
    }

    console.log(`SSE: Client connected for ${affiliateCode}`);

    const stream = new ReadableStream({
        start(controller) {
            // Store controller for this affiliate
            clients.set(affiliateCode, controller);

            // Send initial connection message
            const data = `data: ${JSON.stringify({ type: "connected", message: "Real-time updates enabled" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));

            // Check for unread notifications
            checkNotifications(affiliateCode, controller);
        },
        cancel() {
            console.log(`SSE: Client disconnected for ${affiliateCode}`);
            clients.delete(affiliateCode);
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // For nginx
        },
    });
}

// Check for unread notifications
async function checkNotifications(affiliateCode: string, controller: ReadableStreamDefaultController) {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Check for recently paid withdrawals (last 5 minutes) that haven't been notified
        const result = await pool.query(
            `SELECT id, net_payable, transaction_id, paid_at 
             FROM withdrawal_request 
             WHERE affiliate_code = $1 
             AND status = 'PAID' 
             AND paid_at > NOW() - INTERVAL '5 minutes'
             AND (notified IS NULL OR notified = false)
             ORDER BY paid_at DESC
             LIMIT 5`,
            [affiliateCode]
        );

        for (const row of result.rows) {
            const notificationData = {
                type: "payment_received",
                amount: row.net_payable,
                transactionId: row.transaction_id,
                timestamp: row.paid_at,
                message: `Payment of ₹${parseFloat(row.net_payable).toFixed(2)} received!`
            };

            const data = `data: ${JSON.stringify(notificationData)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));

            // Mark as notified
            await pool.query(
                `UPDATE withdrawal_request SET notified = true WHERE id = $1`,
                [row.id]
            );
        }

        await pool.end();
    } catch (error) {
        console.error("SSE notification check error:", error);
    }
}


