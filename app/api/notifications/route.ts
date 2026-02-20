import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const recipientId = searchParams.get('recipientId');
        const recipientRole = searchParams.get('recipientRole');

        if (!recipientId || !recipientRole) {
            return NextResponse.json({
                success: false,
                error: "Missing recipientId or recipientRole"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Fetch notifications for this admin
        const query = `
            SELECT 
                id,
                sender_id,
                sender_role,
                message,
                type,
                is_read,
                created_at
            FROM notifications
            WHERE recipient_id = $1 AND recipient_role = $2
            ORDER BY created_at DESC
            LIMIT 50
        `;

        const result = await pool.query(query, [recipientId, recipientRole]);

        // Count unread notifications
        const unreadCount = result.rows.filter(n => !n.is_read).length;

        await pool.end();

        return NextResponse.json({
            success: true,
            notifications: result.rows,
            unreadCount
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch notifications:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}

// Mark notification as read
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { notificationId } = body;

        if (!notificationId) {
            return NextResponse.json({
                success: false,
                error: "Missing notificationId"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const query = `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [notificationId]);
        await pool.end();

        return NextResponse.json({
            success: true,
            notification: result.rows[0]
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to update notification:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
