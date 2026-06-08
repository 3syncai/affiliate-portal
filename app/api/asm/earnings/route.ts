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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!city || !state) {
        return NextResponse.json({ success: false, error: "City and State parameters are required" }, { status: 400 });
    }

    console.log(`[ASM API] Fetching earnings for City: ${city}, State: ${state}, AdminID: ${adminId}`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[ASM Earnings]" });

        const commissionRates = await fetchCommissionRates(pool);
        let commissionRate = commissionRates.summary.asm.overrideRate;
        const directRate = commissionRates.summary.asm.directRate;
        let asmReferCode = "";

        if (adminId) {
            const asmDataResult = await pool.query(`
                SELECT asm.refer_code, cr.commission_percentage
                FROM area_sales_manager asm
                LEFT JOIN commission_rates cr ON cr.role_type = 'area'
                WHERE asm.id = $1
            `, [adminId]);

            if (asmDataResult.rows.length > 0) {
                commissionRate = toAmount(asmDataResult.rows[0].commission_percentage ?? commissionRate);
                asmReferCode = asmDataResult.rows[0].refer_code || "";
            }
        }

        const baseStatsResult = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN acl.status = 'CREDITED' THEN acl.commission_amount ELSE 0 END), 0) as credited_commission_base,
                COALESCE(SUM(CASE WHEN acl.status = 'PENDING' THEN acl.commission_amount ELSE 0 END), 0) as pending_commission_base,
                COUNT(CASE WHEN acl.status = 'CREDITED' THEN 1 END) as credited_orders,
                COUNT(CASE WHEN acl.status = 'PENDING' THEN 1 END) as pending_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
        `, [city, state]);

        const baseStats = baseStatsResult.rows[0] || {};
        const creditedAffiliateCommissions = toAmount(baseStats.credited_commission_base);
        const pendingAffiliateCommissions = toAmount(baseStats.pending_commission_base);
        const creditedLegacyEarnings = creditedAffiliateCommissions * (commissionRate / 100);
        const pendingLegacyEarnings = pendingAffiliateCommissions * (commissionRate / 100);
        const baseCreditedOrders = toCount(baseStats.credited_orders);
        const basePendingOrders = toCount(baseStats.pending_orders);

        let creditedBranchOverrideEarnings = 0;
        let pendingBranchOverrideEarnings = 0;
        let branchOverrideCreditedOrders = 0;
        let branchOverridePendingOrders = 0;

        if (adminId) {
            const branchOverrideStatsResult = await pool.query(`
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) as credited_total,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) as pending_total,
                    COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) as credited_count,
                    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count
                FROM affiliate_commission_log
                WHERE commission_source = 'area_manager'
                  AND affiliate_user_id = $1
            `, [adminId]);

            const branchOverrideStats = branchOverrideStatsResult.rows[0] || {};
            creditedBranchOverrideEarnings = toAmount(branchOverrideStats.credited_total);
            pendingBranchOverrideEarnings = toAmount(branchOverrideStats.pending_total);
            branchOverrideCreditedOrders = toCount(branchOverrideStats.credited_count);
            branchOverridePendingOrders = toCount(branchOverrideStats.pending_count);
        }

        let creditedDirectEarnings = 0;
        let pendingDirectEarnings = 0;
        let directCreditedOrders = 0;
        let directPendingOrders = 0;

        if (adminId && asmReferCode) {
            const directStatsResult = await pool.query(`
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN affiliate_commission ELSE 0 END), 0) as credited_total,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN affiliate_commission ELSE 0 END), 0) as pending_total,
                    COUNT(CASE WHEN status = 'CREDITED' THEN 1 END) as credited_count,
                    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count
                FROM affiliate_commission_log
                WHERE commission_source = 'asm_direct'
                  AND (affiliate_user_id = $1 OR affiliate_code = $2)
            `, [adminId, asmReferCode]);

            const directStats = directStatsResult.rows[0] || {};
            creditedDirectEarnings = toAmount(directStats.credited_total);
            pendingDirectEarnings = toAmount(directStats.pending_total);
            directCreditedOrders = toCount(directStats.credited_count);
            directPendingOrders = toCount(directStats.pending_count);
        }

        let paidAmount = 0;
        if (adminId) {
            const paidResult = await pool.query(`
                SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
                FROM admin_payments
                WHERE recipient_id = $1 AND recipient_type = 'asm' AND status = 'completed'
            `, [adminId]);
            paidAmount = toAmount(paidResult.rows[0]?.total_paid);
        }

        const creditedFromBranch = creditedLegacyEarnings + creditedBranchOverrideEarnings;
        const pendingFromBranch = pendingLegacyEarnings + pendingBranchOverrideEarnings;
        const creditedLifetimeEarnings = creditedFromBranch + creditedDirectEarnings;
        const pendingEarnings = pendingFromBranch + pendingDirectEarnings;
        const totalLifetimeEarnings = creditedLifetimeEarnings + pendingEarnings;

        const ordersFromBranch = baseCreditedOrders + basePendingOrders + branchOverrideCreditedOrders + branchOverridePendingOrders;
        const ordersFromDirect = directCreditedOrders + directPendingOrders;
        const totalOrders = ordersFromBranch + ordersFromDirect;
        const currentEarnings = creditedLifetimeEarnings - paidAmount;

        const recentAffiliateOrdersResult = await pool.query(`
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
                acl.commission_source,
                u.first_name,
                u.last_name,
                u.refer_code,
                s.city,
                u.branch
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
            ORDER BY acl.created_at DESC
            LIMIT 20
        `, [city, state, commissionRate]);

        let allOrders = recentAffiliateOrdersResult.rows;

        if (adminId) {
            const branchOverrideOrdersResult = await pool.query(`
                SELECT
                    acl_asm.id,
                    acl_asm.order_id,
                    acl_asm.order_amount,
                    CASE
                        WHEN acl_asm.status = 'CANCELLED' THEN 0
                        WHEN EXISTS (
                            SELECT 1 FROM return_request rr
                            WHERE rr.order_id = acl_asm.order_id
                              AND rr.deleted_at IS NULL
                              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                        ) THEN 0
                        ELSE acl_asm.affiliate_commission
                    END as commission_amount,
                    acl_asm.created_at,
                    acl_asm.product_name,
                    acl_asm.status,
                    acl_asm.unlock_at,
                    acl_asm.credited_at,
                    EXISTS (
                        SELECT 1 FROM return_request rr
                        WHERE rr.order_id = acl_asm.order_id
                          AND rr.deleted_at IS NULL
                          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
                    ) AS has_return,
                    acl_asm.commission_source,
                    COALESCE(ba.first_name, 'Unknown') as first_name,
                    COALESCE(ba.last_name, 'Branch Admin') as last_name,
                    COALESCE(ba.refer_code, 'DIRECT') as refer_code,
                    COALESCE(ba.city, $2) as city,
                    COALESCE(ba.branch, 'Direct Assigned') as branch
                FROM affiliate_commission_log acl_asm
                LEFT JOIN affiliate_commission_log acl_branch
                    ON acl_asm.order_id = acl_branch.order_id
                    AND acl_branch.commission_source = 'branch_admin'
                LEFT JOIN branch_admin ba
                    ON acl_branch.affiliate_user_id = ba.id::text
                WHERE acl_asm.commission_source = 'area_manager'
                  AND acl_asm.affiliate_user_id = $1
                ORDER BY acl_asm.created_at DESC
                LIMIT 20
            `, [adminId, city]);

            allOrders = [...allOrders, ...branchOverrideOrdersResult.rows];
        }

        if (adminId && asmReferCode) {
            const asmDirectOrdersResult = await pool.query(`
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
                    acl.commission_source,
                    acl.customer_name as first_name,
                    '' as last_name,
                    acl.affiliate_code as refer_code,
                    $2 as city,
                    'ASM Direct' as branch
                FROM affiliate_commission_log acl
                WHERE acl.commission_source = 'asm_direct'
                  AND (acl.affiliate_user_id = $1 OR acl.affiliate_code = $3)
                ORDER BY acl.created_at DESC
                LIMIT 20
            `, [adminId, city, asmReferCode]);

            allOrders = [...allOrders, ...asmDirectOrdersResult.rows];
        }

        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        allOrders = allOrders.slice(0, 50);

        return NextResponse.json({
            success: true,
            stats: {
                totalAffiliateCommissions: creditedAffiliateCommissions + pendingAffiliateCommissions,
                totalOrders,
                commissionRate,
                overrideRate: commissionRate,
                directRate,
                lifetimeEarnings: totalLifetimeEarnings,
                creditedLifetimeEarnings,
                pendingEarnings,
                paidAmount,
                currentEarnings,
                totalEarnings: totalLifetimeEarnings,
                earningsFromBranch: creditedFromBranch + pendingFromBranch,
                earningsFromDirect: creditedDirectEarnings + pendingDirectEarnings,
                pendingFromBranch,
                pendingFromDirect: pendingDirectEarnings,
                ordersFromBranch,
                ordersFromDirect
            },
            recentOrders: allOrders
        });
    } catch (error: unknown) {
        console.error("Failed to fetch ASM earnings:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    } finally {
        await pool.end();
    }
}
