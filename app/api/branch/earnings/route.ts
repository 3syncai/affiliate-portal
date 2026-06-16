import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { COMMISSION_HAS_RETURN_SQL } from "@/lib/dashboard-return-sql";
import {
    getBranchAdminPersonalEarnings,
    resolveBranchAdminId,
} from "@/lib/personal-commission-earnings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    let adminId = searchParams.get("adminId");
    const branch = searchParams.get("branch");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        if (!adminId && branch) {
            adminId = await resolveBranchAdminId(pool, branch);
        }

        if (!adminId) {
            return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 });
        }

        await syncAffiliateCommissionStatuses(pool, { logPrefix: "[Branch Earnings]" });

        const commissionRates = await fetchCommissionRates(pool);
        const adminDetailsRef = await pool.query(`
            SELECT ba.refer_code, cr.commission_percentage
            FROM branch_admin ba
            LEFT JOIN commission_rates cr ON cr.role_type = 'branch'
            WHERE ba.id::text = $1::text
        `, [adminId]);

        let commissionRate = commissionRates.summary.branch.overrideRate;
        const directRate = commissionRates.summary.branch.directRate;
        let referCode = "";

        if (adminDetailsRef.rows.length > 0) {
            commissionRate = Number.parseFloat(
                String(adminDetailsRef.rows[0].commission_percentage ?? commissionRate),
            ) || commissionRate;
            referCode = adminDetailsRef.rows[0].refer_code || "";
        }

        const personalEarnings = await getBranchAdminPersonalEarnings(pool, adminId, referCode);

        const creditedOverrideEarnings = personalEarnings.override.credited;
        const creditedDirectEarnings = personalEarnings.direct.credited;
        const pendingOverrideEarnings = personalEarnings.override.pending;
        const pendingDirectEarnings = personalEarnings.direct.pending;

        const creditedOverrideOrders = personalEarnings.override.creditedOrders;
        const creditedDirectOrders = personalEarnings.direct.creditedOrders;
        const pendingOverrideOrders = personalEarnings.override.pendingOrders;
        const pendingDirectOrders = personalEarnings.direct.pendingOrders;

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
        const paidAmount = Number.parseFloat(String(paidResult.rows[0]?.total_paid ?? 0)) || 0;

        const availableBalance = creditedLifetimeEarnings - paidAmount;

        const recentOrdersResult = await pool.query(`
            SELECT
                acl.id,
                acl.order_id,
                acl.order_amount,
                acl.commission_source,
                CASE
                    WHEN acl.status = 'CANCELLED' THEN 0
                    WHEN (${COMMISSION_HAS_RETURN_SQL}) THEN 0
                    ELSE acl.affiliate_commission
                END AS commission_amount,
                acl.created_at,
                acl.product_name,
                acl.status,
                acl.unlock_at,
                acl.credited_at,
                (${COMMISSION_HAS_RETURN_SQL}) AS has_return,
                COALESCE(
                    au.first_name,
                    CASE
                        WHEN acl.commission_source = 'branch_admin'
                          AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) <> LOWER(TRIM($2))
                        THEN NULL
                        ELSE acl.customer_name
                    END,
                    ba.first_name,
                    'Customer'
                ) AS first_name,
                COALESCE(au.last_name, ba.last_name, '') AS last_name,
                acl.affiliate_code AS refer_code,
                acl.affiliate_rate,
                CASE
                    WHEN acl.commission_source = 'branch_admin'
                      AND LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($2))
                    THEN 'Direct Sale'
                    WHEN acl.commission_source = 'branch_admin' THEN 'Sales Executive Sale'
                    ELSE 'Direct Sale'
                END AS type
            FROM affiliate_commission_log acl
            LEFT JOIN affiliate_commission_log se
                ON se.order_id = acl.order_id
                AND se.commission_source = 'affiliate'
            LEFT JOIN affiliate_user au ON au.refer_code = se.affiliate_code
            LEFT JOIN branch_admin ba ON LOWER(TRIM(ba.refer_code)) = LOWER(TRIM(acl.affiliate_code))
            WHERE NULLIF(acl.affiliate_user_id, '') = $1::text
               OR LOWER(TRIM(COALESCE(acl.affiliate_code, ''))) = LOWER(TRIM($2))
            ORDER BY acl.created_at DESC
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
