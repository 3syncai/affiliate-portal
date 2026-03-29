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
    const adminId = searchParams.get("adminId");

    if (!adminId) {
        return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const commissionRates = await fetchCommissionRates(pool);
        const adminDetailsRef = await pool.query(`
            SELECT ba.refer_code, cr.commission_percentage
            FROM branch_admin ba
            LEFT JOIN commission_rates cr ON cr.role_type = 'branch'
            WHERE ba.id = $1
        `, [adminId]);

        let commissionRate = commissionRates.summary.branch.overrideRate;
        const directRate = commissionRates.summary.branch.directRate;
        let referCode = "";

        if (adminDetailsRef.rows.length > 0) {
            commissionRate = toAmount(adminDetailsRef.rows[0].commission_percentage ?? commissionRate);
            referCode = adminDetailsRef.rows[0].refer_code || "";
        }

        const overrideStatsResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) as credited_override_earnings,
                COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) as credited_override_orders,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) as pending_override_earnings,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_override_orders
            FROM affiliate_commission_log
            WHERE commission_source = 'branch_admin'
              AND affiliate_user_id = $1
              AND LOWER(TRIM(COALESCE(affiliate_code, ''))) <> LOWER(TRIM($2))
        `, [adminId, referCode]);

        const directStatsResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) as credited_direct_earnings,
                COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) as credited_direct_orders,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) as pending_direct_earnings,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_direct_orders
            FROM affiliate_commission_log
            WHERE commission_source = 'branch_admin'
              AND LOWER(TRIM(COALESCE(affiliate_code, ''))) = LOWER(TRIM($1))
        `, [referCode]);

        const overrideStats = overrideStatsResult.rows[0] || {};
        const directStats = directStatsResult.rows[0] || {};
        const creditedOverrideEarnings = toAmount(overrideStats.credited_override_earnings);
        const creditedDirectEarnings = toAmount(directStats.credited_direct_earnings);
        const pendingOverrideEarnings = toAmount(overrideStats.pending_override_earnings);
        const pendingDirectEarnings = toAmount(directStats.pending_direct_earnings);

        const creditedOverrideOrders = toCount(overrideStats.credited_override_orders);
        const creditedDirectOrders = toCount(directStats.credited_direct_orders);
        const pendingOverrideOrders = toCount(overrideStats.pending_override_orders);
        const pendingDirectOrders = toCount(directStats.pending_direct_orders);

        const creditedLifetimeEarnings = creditedOverrideEarnings + creditedDirectEarnings;
        const pendingEarnings = pendingOverrideEarnings + pendingDirectEarnings;
        const totalEarnings = creditedLifetimeEarnings + pendingEarnings;

        const totalOrders =
            creditedOverrideOrders +
            creditedDirectOrders +
            pendingOverrideOrders +
            pendingDirectOrders;

        const overrideOrders = creditedOverrideOrders + pendingOverrideOrders;
        const directOrders = creditedDirectOrders + pendingDirectOrders;

        const paidResult = await pool.query(`
            SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
            FROM admin_payments
            WHERE recipient_id = $1 AND recipient_type = 'branch' AND status = 'completed'
        `, [adminId]);
        const paidAmount = toAmount(paidResult.rows[0]?.total_paid);

        const availableBalance = creditedLifetimeEarnings - paidAmount;

        const recentOrdersResult = await pool.query(`
            SELECT
                id,
                order_id,
                order_amount,
                commission_source,
                affiliate_commission as commission_amount,
                created_at,
                product_name,
                status,
                customer_name as first_name,
                '' as last_name,
                affiliate_code as refer_code,
                affiliate_rate,
                CASE
                    WHEN commission_source = 'branch_admin'
                      AND LOWER(TRIM(COALESCE(affiliate_code, ''))) = LOWER(TRIM($2))
                    THEN 'Direct Sale'
                    WHEN commission_source = 'branch_admin' THEN 'Sales Executive Sale'
                    ELSE 'Direct Sale'
                END as type
            FROM affiliate_commission_log
            WHERE affiliate_user_id = $1 OR affiliate_code = $2
            ORDER BY created_at DESC
            LIMIT 20
        `, [adminId, referCode]);

        return NextResponse.json({
            success: true,
            stats: {
                totalEarnings,
                lifetimeEarnings: totalEarnings,
                creditedLifetimeEarnings,
                pendingEarnings,
                overrideEarnings: creditedOverrideEarnings + pendingOverrideEarnings,
                directEarnings: creditedDirectEarnings + pendingDirectEarnings,
                pendingOverrideEarnings,
                pendingDirectEarnings,
                totalOrders,
                overrideOrders,
                directOrders,
                paidAmount,
                availableBalance,
                currentEarnings: availableBalance,
                commissionRate,
                overrideRate: commissionRate,
                directRate,
            },
            recentOrders: recentOrdersResult.rows
        });
    } catch (error: unknown) {
        console.error("Failed to fetch branch earnings:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    } finally {
        await pool.end();
    }
}
