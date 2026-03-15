import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

type Activity = {
    id: string;
    type: 'affiliate_request' | 'order' | 'approval';
    timestamp: string;
    data: any;
};

export async function GET() {
    console.log("=== Fetching Recent Activity ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });
        console.log("Database connected");

        // Fetch recent affiliate requests (last 10)
        const affiliateRequestsQuery = `
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone,
                is_approved,
                created_at,
                updated_at
            FROM affiliate_user
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const affiliateRequestsResult = await pool.query(affiliateRequestsQuery);

        // Fetch recent orders with commissions (last 10)
        const recentOrdersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.affiliate_code,
                acl.product_name,
                acl.commission_amount,
                acl.status,
                acl.created_at,
                u.first_name as affiliate_first_name,
                u.last_name as affiliate_last_name
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            ORDER BY acl.created_at DESC
            LIMIT 10
        `;
        const recentOrdersResult = await pool.query(recentOrdersQuery);

        await pool.end();

        // Combine and format activities
        const activities: Activity[] = [];

        // Add affiliate requests
        affiliateRequestsResult.rows.forEach(row => {
            activities.push({
                id: `request_${row.id}`,
                type: row.is_approved ? 'approval' : 'affiliate_request',
                timestamp: row.is_approved ? row.updated_at : row.created_at,
                data: {
                    name: `${row.first_name} ${row.last_name}`,
                    email: row.email,
                    phone: row.phone,
                    is_approved: row.is_approved,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }
            });
        });

        // Add recent orders
        recentOrdersResult.rows.forEach(row => {
            activities.push({
                id: `order_${row.id}`,
                type: 'order',
                timestamp: row.created_at,
                data: {
                    order_id: row.order_id,
                    affiliate_code: row.affiliate_code,
                    affiliate_name: row.affiliate_first_name && row.affiliate_last_name
                        ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                        : row.affiliate_code,
                    product_name: row.product_name,
                    commission_amount: parseFloat(row.commission_amount) || 0,
                    status: row.status
                }
            });
        });

        // Sort by timestamp (most recent first) and limit to 15
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recentActivities = activities.slice(0, 15);

        console.log(`Returning ${recentActivities.length} recent activities`);
        return NextResponse.json({
            success: true,
            activities: recentActivities,
            count: recentActivities.length
        });

    } catch (error) {
        console.error("Failed to fetch recent activity:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch recent activity",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
