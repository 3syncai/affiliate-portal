import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";

export const dynamic = "force-dynamic";

type GroupedOrder = {
    id: string;
    order_id: string;
    generator_code: string | null;
    generator_name: string | null;
    generator_email: string | null;
    product_name: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    affiliate_earned: number;
    branch_earned: number;
    asm_earned: number;
    my_earned: number;
    status: string;
    created_at: string;
    customer_id: string;
    source_rank: number;
    has_explicit_asm: boolean;
};

const toAmount = (value: string | number | null | undefined) => {
    return Number.parseFloat(String(value ?? 0)) || 0;
};

const toCount = (value: string | number | null | undefined) => {
    return Number.parseInt(String(value ?? 0), 10) || 0;
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get("adminId");
    const city = searchParams.get("city");
    const state = searchParams.get("state");

    if (!adminId || !city || !state) {
        return NextResponse.json(
            { success: false, error: "Admin ID, city and state are required" },
            { status: 400 }
        );
    }

    let pool: Pool | null = null;

    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[ASM Orders]" });

        const asmIdentityResult = await pool.query(
            `SELECT refer_code FROM area_sales_manager WHERE id = $1 LIMIT 1`,
            [adminId]
        );
        const asmReferCode = asmIdentityResult.rows[0]?.refer_code || "";
        const rateResult = await pool.query(
            `SELECT commission_percentage FROM commission_rates WHERE role_type = 'area' LIMIT 1`
        );
        const areaOverrideRate = toAmount(rateResult.rows[0]?.commission_percentage);

        const query = `
            WITH ASMOrders AS (
                SELECT DISTINCT acl.order_id
                FROM affiliate_commission_log acl
                WHERE (
                    acl.commission_source = 'area_manager'
                    AND acl.affiliate_user_id = $1
                )
                OR (
                    acl.commission_source = 'asm_direct'
                    AND (acl.affiliate_user_id = $1 OR acl.affiliate_code = $2)
                )
            ),
            CityOrders AS (
                SELECT DISTINCT acl.order_id
                FROM affiliate_commission_log acl
                JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
                JOIN stores s ON u.branch ILIKE s.branch_name
                WHERE s.city ILIKE $3
                  AND s.state ILIKE $4
                  AND acl.commission_source = 'affiliate'
            ),
            AllRelevantOrders AS (
                SELECT order_id FROM ASMOrders
                UNION
                SELECT order_id FROM CityOrders
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
                acl.commission_amount,
                acl.affiliate_commission,
                acl.commission_source,
                acl.status,
                acl.created_at,
                acl.customer_id,
                au.first_name AS affiliate_first_name,
                au.last_name AS affiliate_last_name,
                au.email AS affiliate_email,
                ba.first_name AS branch_first_name,
                ba.last_name AS branch_last_name,
                ba.email AS branch_email,
                CASE
                    WHEN acl.commission_source = 'affiliate'
                    THEN ROUND((COALESCE(acl.commission_amount, 0) * $6::numeric) / 100, 2)
                    ELSE 0
                END AS derived_asm_amount
            FROM affiliate_commission_log acl
            JOIN AllRelevantOrders ao ON ao.order_id = acl.order_id
            LEFT JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
            LEFT JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            WHERE acl.commission_source = ANY($5::text[])
            ORDER BY acl.created_at DESC
        `;

        const validSources = ["affiliate", "branch_admin", "area_manager", "asm_direct"];
        const result = await pool.query(query, [adminId, asmReferCode, city, state, validSources, areaOverrideRate]);

        const orderMap = new Map<string, GroupedOrder>();

        for (const row of result.rows) {
            if (!orderMap.has(row.order_id)) {
                orderMap.set(row.order_id, {
                    id: row.order_id,
                    order_id: row.order_id,
                    generator_code: null,
                    generator_name: null,
                    generator_email: null,
                    product_name: row.product_name,
                    quantity: toCount(row.quantity),
                    item_price: toAmount(row.item_price),
                    order_amount: toAmount(row.order_amount),
                    affiliate_earned: 0,
                    branch_earned: 0,
                    asm_earned: 0,
                    my_earned: 0,
                    status: row.status,
                    created_at: row.created_at,
                    customer_id: row.customer_id,
                    source_rank: 999,
                    has_explicit_asm: false
                });
            }

            const grouped = orderMap.get(row.order_id);
            if (!grouped) {
                continue;
            }

            const amount = toAmount(row.affiliate_commission ?? row.commission_amount);
            const isMyAreaManagerRow = row.commission_source === "area_manager" && row.affiliate_user_id === adminId;
            const isMyDirectRow =
                row.commission_source === "asm_direct" &&
                (row.affiliate_user_id === adminId || (asmReferCode && row.affiliate_code === asmReferCode));

            if (row.commission_source === "affiliate") {
                grouped.affiliate_earned += amount;
                if (!grouped.has_explicit_asm) {
                    grouped.my_earned += toAmount(row.derived_asm_amount);
                }
            } else if (row.commission_source === "branch_admin") {
                grouped.branch_earned += amount;
            } else if (isMyAreaManagerRow || isMyDirectRow) {
                if (!grouped.has_explicit_asm) {
                    grouped.my_earned = 0;
                }
                grouped.has_explicit_asm = true;
                grouped.asm_earned += amount;
                grouped.my_earned += amount;
                grouped.status = row.status || grouped.status;
            }

            let rank = 999;
            if (row.commission_source === "affiliate") {
                rank = 1;
            } else if (row.commission_source === "branch_admin") {
                rank = 2;
            } else if (row.commission_source === "area_manager" || row.commission_source === "asm_direct") {
                rank = 3;
            }

            if (rank < grouped.source_rank) {
                grouped.source_rank = rank;
                grouped.generator_code = row.affiliate_code;

                if (row.commission_source === "affiliate") {
                    grouped.generator_name = row.affiliate_first_name && row.affiliate_last_name
                        ? `${row.affiliate_first_name} ${row.affiliate_last_name}`
                        : row.affiliate_code;
                    grouped.generator_email = row.affiliate_email;
                } else if (row.commission_source === "branch_admin") {
                    grouped.generator_name = row.branch_first_name && row.branch_last_name
                        ? `${row.branch_first_name} ${row.branch_last_name}`
                        : row.affiliate_code;
                    grouped.generator_email = row.branch_email;
                } else {
                    grouped.generator_name = row.affiliate_code;
                    grouped.generator_email = null;
                }
            }
        }

        for (const grouped of orderMap.values()) {
            if (grouped.asm_earned <= 0 && grouped.my_earned > 0) {
                grouped.asm_earned = grouped.my_earned;
            }
        }

        const orders = Array.from(orderMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return NextResponse.json({
            success: true,
            orders,
            count: orders.length
        });
    } catch (error: unknown) {
        console.error("[ASM Orders API] Failed:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch ASM orders",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}
