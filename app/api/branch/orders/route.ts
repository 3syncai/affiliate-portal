import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";

export const dynamic = "force-dynamic";

type GroupedOrder = {
    id: string;
    order_id: string;
    product_name: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    status: string;
    created_at: string;
    customer_id: string;
    generator_code: string | null;
    generator_name: string | null;
    generator_email: string | null;
    source_rank: number;
    affiliate_earned: number;
    branch_earned: number;
    asm_earned: number;
    my_earned: number;
};

export async function GET(req: NextRequest) {
    console.log("=== Fetching Branch Affiliate Orders ===");
    let pool: Pool | null = null;

    try {
        const { searchParams } = new URL(req.url);
        const adminId = searchParams.get('adminId');
        const role = searchParams.get('role');

        if (!adminId) {
            return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 });
        }

        pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[Branch Orders]" });

        let validSources: string[] = [];

        // Handle both area_manager (Branch Admin) and branch_admin (ASM)
        if (role === 'area_manager') {
            // Branch Admins (Area Managers) can see their own overrides, downline ASMs, and bottom Affiliates
            validSources = ['area_manager', 'asm_direct', 'branch_admin', 'affiliate'];
        } else if (role === 'branch_admin' || !role) {
            // ASMs can only see their own overrides and bottom Affiliates
            validSources = ['branch_admin', 'affiliate'];
        } else {
            validSources = ['affiliate', 'branch_admin', 'area_manager', 'asm_direct'];
        }

        // Query to get downline affiliate orders for this specific admin
        // 1. We find all order_ids where this admin earned a commission
        // 2. For those order_ids, we grab the commission logs that match the downline sources
        const query = `
            WITH AdminOrders AS (
                SELECT DISTINCT order_id 
                FROM affiliate_commission_log 
                WHERE affiliate_user_id = $1
            )
            SELECT 
                acl.id,
                acl.order_id,
                acl.affiliate_user_id,
                acl.affiliate_code,
                acl.product_name,
                acl.quantity,
                acl.item_price,
                acl.order_amount,
                acl.commission_rate,
                acl.commission_amount,
                acl.affiliate_commission,
                acl.commission_source,
                acl.status,
                acl.created_at,
                u.first_name as affiliate_first_name,
                u.last_name as affiliate_last_name,
                u.email as affiliate_email,
                acl.customer_id
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN AdminOrders ao ON acl.order_id = ao.order_id
            WHERE acl.commission_source = ANY($2::text[])
            ORDER BY acl.created_at ASC
        `;

        const result = await pool.query(query, [adminId, validSources]);

        const orderMap = new Map<string, GroupedOrder>();

        for (const row of result.rows) {
            if (!orderMap.has(row.order_id)) {
                orderMap.set(row.order_id, {
                    id: row.order_id,
                    order_id: row.order_id,
                    product_name: row.product_name,
                    quantity: parseInt(row.quantity) || 0,
                    item_price: parseFloat(row.item_price) || 0,
                    order_amount: parseFloat(row.order_amount) || 0,
                    status: row.status,
                    created_at: row.created_at,
                    customer_id: row.customer_id,

                    generator_code: null,
                    generator_name: null,
                    generator_email: null,
                    source_rank: 999,

                    affiliate_earned: 0,
                    branch_earned: 0,
                    asm_earned: 0,
                    my_earned: 0,
                });
            }

            const grouped = orderMap.get(row.order_id);
            if (!grouped) {
                continue;
            }
            const amount = parseFloat(row.affiliate_commission ?? row.commission_amount) || 0;

            if (row.commission_source === 'affiliate') {
                grouped.affiliate_earned += amount;
            } else if (row.commission_source === 'branch_admin') {
                grouped.branch_earned += amount;
            } else if (row.commission_source === 'area_manager' || row.commission_source === 'asm_direct') {
                grouped.asm_earned += amount;
            }

            if (row.affiliate_user_id === adminId) {
                grouped.my_earned += amount;
            }

            // Find the bottom-most referrer (1=affiliate, 2=branch_admin, 3=area_manager)
            let rank = 999;
            if (row.commission_source === 'affiliate') rank = 1;
            else if (row.commission_source === 'branch_admin') rank = 2;
            else if (row.commission_source === 'area_manager' || row.commission_source === 'asm_direct') rank = 3;

            if (rank < grouped.source_rank) {
                grouped.source_rank = rank;
                grouped.generator_code = row.affiliate_code;
                grouped.generator_name = row.affiliate_first_name && row.affiliate_last_name
                    ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                    : row.affiliate_code;
                grouped.generator_email = row.affiliate_email;
            }
        }

        const orders = Array.from(orderMap.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return NextResponse.json({
            success: true,
            orders,
            count: orders.length
        });

    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error("Failed to fetch branch orders:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch orders",
                message: err.message || "Unknown error"
            },
            { status: 500 }
        );
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}
