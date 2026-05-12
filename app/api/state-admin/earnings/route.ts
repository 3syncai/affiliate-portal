import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) => {
    return Number.parseFloat(String(value ?? 0)) || 0;
};

const toCount = (value: string | number | null | undefined) => {
    return Number.parseInt(String(value ?? 0), 10) || 0;
};

// Legacy delivered-commission sync. The canonical sync now lives in
// `syncAffiliateCommissionStatuses` and applies the 5-minute unlock window
// plus return-voiding. This function used to flip rows straight to CREDITED
// without any delay, which would skip the timer entirely, so it is no longer
// invoked from the route below.
async function syncDeliveredCommissions(pool: Pool, logPrefix: string) {
    try {
        const orderTableRes = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('order', 'orders')
            LIMIT 1
        `
        );

        if (orderTableRes.rows.length === 0) {
            console.warn(`${logPrefix} Status sync skipped: order table not found`);
            return;
        }

        const orderTable = orderTableRes.rows[0].table_name;
        const orderColsRes = await pool.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
        `,
            [orderTable]
        );
        const orderCols = new Set(orderColsRes.rows.map((row: { column_name: string }) => row.column_name));

        const conditions: string[] = [];
        if (orderCols.has("fulfillment_status")) {
            conditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('delivered','fulfilled','shipped')");
        }
        if (orderCols.has("payment_status")) {
            conditions.push("LOWER(COALESCE(o.payment_status::text, '')) IN ('captured','partially_captured')");
        }
        if (orderCols.has("status")) {
            conditions.push("LOWER(COALESCE(o.status::text, '')) IN ('completed')");
        }
        if (orderCols.has("metadata")) {
            conditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'delivered'");
            conditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'fulfilled'");
            conditions.push("o.metadata->>'shiprocket_delivered_at' IS NOT NULL");
        }

        const extraAnd: string[] = [];
        if (orderCols.has("canceled_at")) {
            extraAnd.push("o.canceled_at IS NULL");
        }

        let joinClause = "";
        const fulfillmentTableRes = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'fulfillment'
            LIMIT 1
        `
        );

        if (fulfillmentTableRes.rows.length > 0) {
            const fulfillmentColsRes = await pool.query(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fulfillment'
            `
            );
            const fulfillmentCols = new Set(
                fulfillmentColsRes.rows.map((row: { column_name: string }) => row.column_name)
            );

            if (fulfillmentCols.has("order_id")) {
                joinClause = "LEFT JOIN fulfillment f ON f.order_id = o.id";
            } else {
                const orderFulfillmentTableRes = await pool.query(
                    `
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'order_fulfillment'
                    LIMIT 1
                `
                );

                if (orderFulfillmentTableRes.rows.length > 0) {
                    joinClause = `
                    LEFT JOIN order_fulfillment ofl ON ofl.order_id = o.id
                    LEFT JOIN fulfillment f ON f.id = ofl.fulfillment_id
                `;
                }
            }

            if (joinClause) {
                if (fulfillmentCols.has("delivered_at")) {
                    conditions.push("f.delivered_at IS NOT NULL");
                }
                if (fulfillmentCols.has("shipped_at")) {
                    conditions.push("f.shipped_at IS NOT NULL");
                }
                if (fulfillmentCols.has("status")) {
                    conditions.push("LOWER(COALESCE(f.status::text, '')) IN ('delivered','fulfilled','shipped')");
                }
                if (fulfillmentCols.has("canceled_at")) {
                    extraAnd.push("f.canceled_at IS NULL");
                }
            }
        }

        if (conditions.length === 0) {
            console.warn(`${logPrefix} Status sync skipped: no usable status columns found`);
            return;
        }

        const whereClause = conditions.join(" OR ");
        const extraClause = extraAnd.length > 0 ? `AND ${extraAnd.join(" AND ")}` : "";

        await pool.query(`
            UPDATE affiliate_commission_log acl
            SET status = 'CREDITED',
                credited_at = COALESCE(acl.credited_at, NOW())
            FROM "${orderTable}" o
            ${joinClause}
            WHERE o.id = acl.order_id
              AND acl.status IS DISTINCT FROM 'CREDITED'
              AND (${whereClause})
              ${extraClause}
        `);
    } catch (syncError) {
        console.warn(`${logPrefix} Status sync skipped:`, syncError);
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!state || !adminId) {
        return NextResponse.json({ success: false, error: "State and Admin ID parameters are required" }, { status: 400 });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[State Admin Earnings]" });

        const commissionRates = await fetchCommissionRates(pool);
        const adminCheck = await pool.query(`
            SELECT refer_code
            FROM state_admin
            WHERE id = $1
        `, [adminId]);
        const referCode = adminCheck.rows[0]?.refer_code || "";
        const commissionRate = commissionRates.summary.state.overrideRate;
        const directRate = commissionRates.summary.state.directRate;

        const affiliateOverrideResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.commission_amount ELSE 0 END), 0) as credited_total,
                COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.commission_amount ELSE 0 END), 0) as pending_total,
                COUNT(CASE WHEN acl.status = 'CREDITED' THEN 1 END) as credited_count,
                COUNT(CASE WHEN acl.status = 'PENDING' THEN 1 END) as pending_count
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.state ILIKE $1
              AND acl.commission_source = 'affiliate'
        `, [state]);

        const branchOverrideResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.commission_amount ELSE 0 END), 0) as credited_total,
                COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.commission_amount ELSE 0 END), 0) as pending_total,
                COUNT(CASE WHEN acl.status = 'CREDITED' THEN 1 END) as credited_count,
                COUNT(CASE WHEN acl.status = 'PENDING' THEN 1 END) as pending_count
            FROM affiliate_commission_log acl
            JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
            WHERE ba.state ILIKE $1
              AND acl.commission_source = 'branch_admin'
        `, [state]);

        const asmOverrideResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.commission_amount ELSE 0 END), 0) as credited_total,
                COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.commission_amount ELSE 0 END), 0) as pending_total,
                COUNT(CASE WHEN acl.status = 'CREDITED' THEN 1 END) as credited_count,
                COUNT(CASE WHEN acl.status = 'PENDING' THEN 1 END) as pending_count
            FROM affiliate_commission_log acl
            JOIN area_sales_manager asm ON acl.affiliate_code = asm.refer_code
            WHERE asm.state ILIKE $1
              AND acl.commission_source = 'asm_direct'
        `, [state]);

        const creditedOverrideBase =
            toAmount(affiliateOverrideResult.rows[0]?.credited_total) +
            toAmount(branchOverrideResult.rows[0]?.credited_total) +
            toAmount(asmOverrideResult.rows[0]?.credited_total);

        const pendingOverrideBase =
            toAmount(affiliateOverrideResult.rows[0]?.pending_total) +
            toAmount(branchOverrideResult.rows[0]?.pending_total) +
            toAmount(asmOverrideResult.rows[0]?.pending_total);

        const creditedOverrideOrders =
            toCount(affiliateOverrideResult.rows[0]?.credited_count) +
            toCount(branchOverrideResult.rows[0]?.credited_count) +
            toCount(asmOverrideResult.rows[0]?.credited_count);

        const pendingOverrideOrders =
            toCount(affiliateOverrideResult.rows[0]?.pending_count) +
            toCount(branchOverrideResult.rows[0]?.pending_count) +
            toCount(asmOverrideResult.rows[0]?.pending_count);

        const creditedOverrideEarnings = creditedOverrideBase * (commissionRate / 100);
        const pendingOverrideEarnings = pendingOverrideBase * (commissionRate / 100);

        let creditedDirectEarnings = 0;
        let pendingDirectEarnings = 0;
        let creditedDirectOrders = 0;
        let pendingDirectOrders = 0;

        if (referCode) {
            const directResult = await pool.query(`
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) as credited_total,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) as pending_total,
                    COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) as credited_count,
                    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count
                FROM affiliate_commission_log
                WHERE commission_source = 'state_admin_direct'
                  AND affiliate_code = $1
            `, [referCode]);

            creditedDirectEarnings = toAmount(directResult.rows[0]?.credited_total);
            pendingDirectEarnings = toAmount(directResult.rows[0]?.pending_total);
            creditedDirectOrders = toCount(directResult.rows[0]?.credited_count);
            pendingDirectOrders = toCount(directResult.rows[0]?.pending_count);
        }

        const lifetimeEarnings =
            creditedOverrideEarnings +
            pendingOverrideEarnings +
            creditedDirectEarnings +
            pendingDirectEarnings;

        const currentEarnings = creditedOverrideEarnings + creditedDirectEarnings;
        const pendingEarnings = pendingOverrideEarnings + pendingDirectEarnings;

        const paidResult = await pool.query(`
            SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
            FROM admin_payments
            WHERE recipient_id = $1 AND recipient_type = 'state' AND status = 'completed'
        `, [adminId]);
        const paidAmount = toAmount(paidResult.rows[0]?.total_paid);

        const availableBalance = currentEarnings - paidAmount;
        const totalOrders = creditedOverrideOrders + pendingOverrideOrders + creditedDirectOrders + pendingDirectOrders;

        // Each sub-select carries the same shape: status, unlock_at,
        // credited_at, has_return + a commission_amount that drops to 0 if
        // the order is cancelled or the customer has filed a return.
        const recentOrdersResult = await pool.query(`
            (
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN acl.status = 'CANCELLED' THEN 0
                        WHEN EXISTS (
                            SELECT 1 FROM return_request rr
                            WHERE rr.order_id = acl.order_id
                              AND rr.deleted_at IS NULL
                              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                        ) THEN 0
                        ELSE ROUND((acl.commission_amount * $3::numeric) / 100, 2)
                    END as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    EXISTS (
                        SELECT 1 FROM return_request rr
                        WHERE rr.order_id = acl.order_id
                          AND rr.deleted_at IS NULL
                          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                    ) AS has_return,
                    u.first_name,
                    u.last_name,
                    u.refer_code,
                    s.city,
                    s.branch_name as branch,
                    'Team Sales Commission' as type
                FROM affiliate_commission_log acl
                JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
                JOIN stores s ON u.branch ILIKE s.branch_name
                WHERE s.state ILIKE $1
                  AND acl.commission_source = 'affiliate'
            )
            UNION ALL
            (
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN acl.status = 'CANCELLED' THEN 0
                        WHEN EXISTS (
                            SELECT 1 FROM return_request rr
                            WHERE rr.order_id = acl.order_id
                              AND rr.deleted_at IS NULL
                              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                        ) THEN 0
                        ELSE ROUND((acl.commission_amount * $3::numeric) / 100, 2)
                    END as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    EXISTS (
                        SELECT 1 FROM return_request rr
                        WHERE rr.order_id = acl.order_id
                          AND rr.deleted_at IS NULL
                          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                    ) AS has_return,
                    ba.first_name,
                    ba.last_name,
                    ba.refer_code,
                    ba.city,
                    ba.branch,
                    'Team Sales Commission' as type
                FROM affiliate_commission_log acl
                JOIN branch_admin ba ON acl.affiliate_code = ba.refer_code
                WHERE ba.state ILIKE $1
                  AND acl.commission_source = 'branch_admin'
            )
            UNION ALL
            (
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN acl.status = 'CANCELLED' THEN 0
                        WHEN EXISTS (
                            SELECT 1 FROM return_request rr
                            WHERE rr.order_id = acl.order_id
                              AND rr.deleted_at IS NULL
                              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                        ) THEN 0
                        ELSE ROUND((acl.commission_amount * $3::numeric) / 100, 2)
                    END as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    EXISTS (
                        SELECT 1 FROM return_request rr
                        WHERE rr.order_id = acl.order_id
                          AND rr.deleted_at IS NULL
                          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                    ) AS has_return,
                    asm.first_name,
                    asm.last_name,
                    asm.refer_code,
                    asm.city,
                    'ASM Direct' as branch,
                    'Team Sales Commission' as type
                FROM affiliate_commission_log acl
                JOIN area_sales_manager asm ON acl.affiliate_code = asm.refer_code
                WHERE asm.state ILIKE $1
                  AND acl.commission_source = 'asm_direct'
            )
            UNION ALL
            (
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN acl.status = 'CANCELLED' THEN 0
                        WHEN EXISTS (
                            SELECT 1 FROM return_request rr
                            WHERE rr.order_id = acl.order_id
                              AND rr.deleted_at IS NULL
                              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                        ) THEN 0
                        ELSE acl.affiliate_commission
                    END as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    EXISTS (
                        SELECT 1 FROM return_request rr
                        WHERE rr.order_id = acl.order_id
                          AND rr.deleted_at IS NULL
                          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                    ) AS has_return,
                    'You' as first_name,
                    '' as last_name,
                    acl.affiliate_code as refer_code,
                    'N/A' as city,
                    'N/A' as branch,
                    'Direct' as type
                FROM affiliate_commission_log acl
                WHERE acl.commission_source = 'state_admin_direct'
                  AND acl.affiliate_code = $2
            )
            ORDER BY created_at DESC
            LIMIT 20
        `, [state, referCode || "INVALID", commissionRate]);

        return NextResponse.json({
            success: true,
            stats: {
                totalOrders,
                commissionRate,
                overrideRate: commissionRate,
                directRate,
                lifetimeEarnings,
                creditedLifetimeEarnings: currentEarnings,
                pendingEarnings,
                paidAmount,
                currentEarnings: availableBalance,
                availableBalance,
                earningsFromOverrides: creditedOverrideEarnings + pendingOverrideEarnings,
                earningsFromDirect: creditedDirectEarnings + pendingDirectEarnings,
                pendingFromOverrides: pendingOverrideEarnings,
                pendingFromDirect: pendingDirectEarnings,
                ordersFromOverrides: creditedOverrideOrders + pendingOverrideOrders,
                ordersFromDirect: creditedDirectOrders + pendingDirectOrders
            },
            recentOrders: recentOrdersResult.rows
        });
    } catch (error: unknown) {
        console.error("Failed to fetch state admin earnings:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    } finally {
        await pool.end();
    }
}
