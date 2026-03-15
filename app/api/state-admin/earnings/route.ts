import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchCommissionRates } from "@/lib/commission-rates";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) => {
    return Number.parseFloat(String(value ?? 0)) || 0;
};

const toCount = (value: string | number | null | undefined) => {
    return Number.parseInt(String(value ?? 0), 10) || 0;
};

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

        const recentOrdersResult = await pool.query(`
            (
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    ROUND((acl.commission_amount * $3::numeric) / 100, 2) as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    u.first_name,
                    u.last_name,
                    u.refer_code,
                    s.city,
                    s.branch_name as branch,
                    'Override' as type
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
                    ROUND((acl.commission_amount * $3::numeric) / 100, 2) as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    ba.first_name,
                    ba.last_name,
                    ba.refer_code,
                    ba.city,
                    ba.branch,
                    'Override' as type
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
                    ROUND((acl.commission_amount * $3::numeric) / 100, 2) as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    asm.first_name,
                    asm.last_name,
                    asm.refer_code,
                    asm.city,
                    'ASM Direct' as branch,
                    'Override' as type
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
                    acl.affiliate_commission as commission_amount,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
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
