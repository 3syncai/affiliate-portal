import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";
import { getBmPersonalEarnings } from "@/lib/personal-commission-earnings";

export const dynamic = "force-dynamic";

const toAmount = (value: string | number | null | undefined) => {
    return Number.parseFloat(String(value ?? 0)) || 0;
};

const RETURN_VOID_SQL = `
    acl.status = 'CANCELLED'
    OR (${COMMISSION_HAS_RETURN_SQL})
`;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const adminId = searchParams.get("adminId");

    if (!city || !state) {
        return NextResponse.json({ success: false, error: "City and State parameters are required" }, { status: 400 });
    }

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

        let creditedOverrideEarnings = 0;
        let pendingOverrideEarnings = 0;
        let overrideCreditedOrders = 0;
        let overridePendingOrders = 0;
        let creditedDirectEarnings = 0;
        let pendingDirectEarnings = 0;
        let directCreditedOrders = 0;
        let directPendingOrders = 0;

        if (adminId) {
            const bmEarnings = await getBmPersonalEarnings(pool, adminId, asmReferCode);
            creditedOverrideEarnings = bmEarnings.override.credited;
            pendingOverrideEarnings = bmEarnings.override.pending;
            overrideCreditedOrders = bmEarnings.override.creditedOrders;
            overridePendingOrders = bmEarnings.override.pendingOrders;
            creditedDirectEarnings = bmEarnings.direct.credited;
            pendingDirectEarnings = bmEarnings.direct.pending;
            directCreditedOrders = bmEarnings.direct.creditedOrders;
            directPendingOrders = bmEarnings.direct.pendingOrders;
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

        const creditedFromBranch = creditedOverrideEarnings;
        const pendingFromBranch = pendingOverrideEarnings;
        const creditedLifetimeEarnings = creditedFromBranch + creditedDirectEarnings;
        const pendingEarnings = pendingFromBranch + pendingDirectEarnings;
        const totalLifetimeEarnings = creditedLifetimeEarnings + pendingEarnings;

        const ordersFromBranch = overrideCreditedOrders + overridePendingOrders;
        const ordersFromDirect = directCreditedOrders + directPendingOrders;
        const totalOrders = ordersFromBranch + ordersFromDirect;
        const currentEarnings = creditedLifetimeEarnings - paidAmount;

        let allOrders: Record<string, unknown>[] = [];

        if (adminId) {
            const recentOverrideOrdersResult = await pool.query(`
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN ${RETURN_VOID_SQL} THEN 0
                        ELSE acl.affiliate_commission
                    END AS your_earning,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
                    acl.commission_source,
                    COALESCE(u.first_name, ba.first_name, 'Customer') AS first_name,
                    COALESCE(u.last_name, ba.last_name, '') AS last_name,
                    TRIM(CONCAT(
                        COALESCE(u.first_name, ba.first_name, 'Customer'),
                        ' ',
                        COALESCE(u.last_name, ba.last_name, '')
                    )) AS participant_name,
                    COALESCE(u.refer_code, ba.refer_code) AS refer_code,
                    COALESCE(s.city, ba.city, $2) AS city,
                    COALESCE(u.branch, ba.branch) AS branch,
                    COALESCE(u.branch, ba.branch) AS participant_branch,
                    CASE
                        WHEN se.id IS NOT NULL THEN 'Sales Executive Sale'
                        WHEN ba.id IS NOT NULL THEN 'ASM Sale'
                        ELSE 'Sales Executive Sale'
                    END AS type
                FROM affiliate_commission_log acl
                LEFT JOIN affiliate_commission_log se
                    ON se.order_id = acl.order_id
                    AND se.commission_source = 'affiliate'
                LEFT JOIN affiliate_user u ON u.refer_code = se.affiliate_code
                LEFT JOIN stores s ON u.branch ILIKE s.branch_name
                LEFT JOIN affiliate_commission_log ba_row
                    ON ba_row.order_id = acl.order_id
                    AND ba_row.commission_source = 'branch_admin'
                    AND se.id IS NULL
                LEFT JOIN branch_admin ba ON NULLIF(ba_row.affiliate_user_id, '') = ba.id::text
                WHERE acl.commission_source = 'area_manager'
                  AND NULLIF(acl.affiliate_user_id, '') = $1::text
                ORDER BY acl.created_at DESC
                LIMIT 20
            `, [adminId, city]);

            allOrders = recentOverrideOrdersResult.rows.map((row) => ({
                ...row,
                commission_amount: row.your_earning,
            }));
        }

        if (adminId && asmReferCode) {
            const asmDirectOrdersResult = await pool.query(`
                SELECT
                    acl.id,
                    acl.order_id,
                    acl.order_amount,
                    CASE
                        WHEN ${RETURN_VOID_SQL} THEN 0
                        ELSE acl.affiliate_commission
                    END AS your_earning,
                    CASE
                        WHEN ${RETURN_VOID_SQL} THEN 0
                        ELSE acl.affiliate_commission
                    END AS participant_earning,
                    acl.created_at,
                    acl.product_name,
                    acl.status,
                    acl.unlock_at,
                    acl.credited_at,
                    (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
                    acl.commission_source,
                    acl.customer_name AS first_name,
                    '' AS last_name,
                    COALESCE(acl.customer_name, 'Customer') AS participant_name,
                    acl.affiliate_code AS refer_code,
                    $2 AS city,
                    'BM Direct' AS branch,
                    'Direct' AS participant_branch
                FROM affiliate_commission_log acl
                WHERE acl.commission_source = 'asm_direct'
                  AND (
                    NULLIF(acl.affiliate_user_id, '') = $1::text
                    OR LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($3))
                  )
                ORDER BY acl.created_at DESC
                LIMIT 20
            `, [adminId, city, asmReferCode]);

            allOrders = [
                ...allOrders,
                ...asmDirectOrdersResult.rows.map((row) => ({
                    ...row,
                    commission_amount: row.your_earning,
                })),
            ];
        }

        allOrders.sort(
            (a, b) =>
                new Date(String(b.created_at)).getTime() -
                new Date(String(a.created_at)).getTime(),
        );
        allOrders = allOrders.slice(0, 20).map((row) => {
            const commissionSource = String(row.commission_source ?? "");
            const isDirect =
                commissionSource === "asm_direct" || row.branch === "BM Direct";
            const type =
                isDirect
                    ? "Direct Sale"
                    : String(row.type ?? "") ||
                      (commissionSource === "area_manager"
                          ? "Sales Executive Sale"
                          : "Sales Executive Sale");

            return {
                ...row,
                type,
                participant_branch:
                    String(row.participant_branch ?? row.branch ?? "").trim() ||
                    (isDirect ? "Direct" : ""),
                commission_amount: row.commission_amount ?? row.your_earning,
            };
        });

        return NextResponse.json({
            success: true,
            stats: {
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
                ordersFromDirect,
            },
            recentOrders: allOrders,
        });
    } catch (error: unknown) {
        console.error("Failed to fetch ASM earnings:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    } finally {
        await pool.end();
    }
}
