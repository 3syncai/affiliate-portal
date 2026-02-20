import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    console.log("=== Fetching ASM Earnings ===");

    try {
        const { searchParams } = new URL(req.url);
        const asmId = searchParams.get('asmId');

        if (!asmId) {
            return NextResponse.json({ success: false, error: "ASM ID is required" }, { status: 400 });
        }

        // 1. Get Direct Earnings (as an agent/affiliate)
        // Check if this ASM is also an agent using refer_code
        const asmInfo = await pool.query(
            `SELECT refer_code FROM area_sales_manager WHERE id = $1`,
            [asmId]
        );

        let directAsmEarnings = 0;
        if (asmInfo.rows.length > 0 && asmInfo.rows[0].refer_code) {
            const referCode = asmInfo.rows[0].refer_code;
            const directResult = await pool.query(
                `SELECT COALESCE(SUM(COALESCE(affiliate_amount, commission_amount * 0.70)), 0) as total 
                 FROM affiliate_commission_log 
                 WHERE affiliate_code = $1 AND status = 'CREDITED'`,
                [referCode]
            );
            directAsmEarnings = parseFloat(directResult.rows[0]?.total || '0');
        }

        // 2. Get Legacy Wallet Earnings (backward compatibility)
        const walletResult = await pool.query(
            `SELECT COALESCE(total_commission, 0) as total, COALESCE(wallet_amount, 0) as balance, 
             COALESCE(pending_amount, 0) as pending
             FROM customer_wallet WHERE affiliate_id = $1`,
            [asmId]
        );
        const lifetimeEarningsLegacy = parseFloat(walletResult.rows[0]?.total || '0');
        const currentBalance = parseFloat(walletResult.rows[0]?.balance || '0');
        const pendingAmount = parseFloat(walletResult.rows[0]?.pending || '0');

        // Total lifetime
        const totalLifetimeEarnings = lifetimeEarningsLegacy + directAsmEarnings;

        // 3. Get Monthly Earnings (This month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // From commission log (for current month)
        let monthlyCommissions = 0;
        if (asmInfo.rows.length > 0 && asmInfo.rows[0].refer_code) {
            const monthlyResult = await pool.query(
                `SELECT COALESCE(SUM(COALESCE(affiliate_amount, commission_amount * 0.70)), 0) as total 
                 FROM affiliate_commission_log 
                 WHERE affiliate_code = $1 AND status = 'CREDITED' AND created_at >= $2`,
                [asmInfo.rows[0].refer_code, startOfMonth.toISOString()]
            );
            monthlyCommissions = parseFloat(monthlyResult.rows[0]?.total || '0');
        }

        // 4. Get Earnings from Branches (Team overrides)
        // Fetch all branches under this ASM
        const branchesResult = await pool.query(
            `SELECT branch FROM branch_admin WHERE asm_id = $1`,
            [asmId]
        );

        const branchList = branchesResult.rows.map(row => row.branch);
        console.log(`ASM ${asmId} has ${branchList.length} branches`);

        let teamEarnings = 0;
        if (branchList.length > 0) {
            const teamResult = await pool.query(
                `SELECT COALESCE(SUM(commission_amount * 0.05), 0) as total 
                 FROM affiliate_commission_log acl
                 JOIN affiliate_user au ON acl.affiliate_code = au.refer_code
                 WHERE au.branch = ANY($1) AND acl.status = 'CREDITED'`,
                [branchList]
            );
            teamEarnings = parseFloat(teamResult.rows[0]?.total || '0');
        }

        // 5. Get Recent 20 Transactions
        // We need to pass referCode for the direct commissions and asmId for withdrawals
        const referCode = asmInfo.rows[0]?.refer_code || 'NONE';

        const transactionsResult = await pool.query(
            `SELECT 'DIRECT' as type, product_name as description, 
             COALESCE(affiliate_amount, commission_amount * 0.70) as amount, 
             created_at as date, status
             FROM affiliate_commission_log 
             WHERE affiliate_code = $1
             UNION ALL
             SELECT 'WITHDRAWAL' as type, 'Withdrawal' as description, 
             withdrawal_amount as amount, requested_at as date, status
             FROM withdrawal_request
             WHERE affiliate_id = $2
             ORDER BY date DESC
             LIMIT 20`,
            [referCode, asmId]
        );


        return NextResponse.json({
            success: true,
            earnings: {
                lifetime: totalLifetimeEarnings,
                monthly: monthlyCommissions,
                currentBalance,
                pendingAmount,
                teamEarnings
            },
            recentTransactions: transactionsResult.rows
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch ASM earnings:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
