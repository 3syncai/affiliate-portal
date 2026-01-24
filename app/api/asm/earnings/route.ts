import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const adminId = searchParams.get('adminId'); // ASM's ID for payment tracking

        if (!city || !state) {
            return NextResponse.json({ success: false, error: "City and State parameters are required" }, { status: 400 });
        }

        console.log(`[ASM API] Fetching earnings for City: ${city}, State: ${state}, AdminID: ${adminId}`);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // 1. Get Commission Rate & Refer Code for ASM (should be 2%)
        const asmDataResult = await pool.query(`
            SELECT commission_percentage, refer_code 
            FROM commission_rates 
            CROSS JOIN area_sales_manager asm
            WHERE commission_rates.role_type = 'area' AND asm.id = $1
        `, [adminId]);

        let commissionRate = 2.0;
        let asmReferCode = '';

        if (asmDataResult.rows.length > 0) {
            commissionRate = parseFloat(asmDataResult.rows[0].commission_percentage || '2.0');
            asmReferCode = asmDataResult.rows[0].refer_code;
        }

        // 2. Calculate total AFFILIATE COMMISSIONS in this city/state
        const commissionsQuery = `
            SELECT 
                COALESCE(SUM(acl.commission_amount), 0) as total_affiliate_commissions
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
        `;

        const commissionsResult = await pool.query(commissionsQuery, [city, state]);
        const totalAffiliateCommissions = parseFloat(commissionsResult.rows[0].total_affiliate_commissions || '0');

        // 3. Calculate ASM Lifetime Earnings from REGULAR AFFILIATES (Legacy Logic)
        const lifetimeEarningsLegacy = totalAffiliateCommissions * (commissionRate / 100);

        // 3b. Calculate ASM Earnings from DIRECT LOGS (New Logic via commission_source='area_manager')
        // This captures commissions from Branch Admin referrals (which don't join with affiliate_user)
        let directAsmEarnings = 0;
        if (adminId) {
            const directLogsQuery = `
                SELECT COALESCE(SUM(affiliate_commission), 0) as total
                FROM affiliate_commission_log
                WHERE commission_source = 'area_manager' 
                  AND affiliate_user_id = $1
                  AND status = 'CREDITED'
            `;
            const directLogsResult = await pool.query(directLogsQuery, [adminId]);
            directAsmEarnings = parseFloat(directLogsResult.rows[0].total || '0');
        }

        const lifetimeEarnings = lifetimeEarningsLegacy + directAsmEarnings;

        // 4. Get Total Paid Amount to this admin
        let paidAmount = 0;
        if (adminId) {
            const paidQuery = `
                SELECT COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE (amount + COALESCE(tds_amount, 0)) END), 0) as total_paid
                FROM admin_payments
                WHERE recipient_id = $1 AND recipient_type = 'asm' AND status = 'completed'
            `;
            const paidResult = await pool.query(paidQuery, [adminId]);
            paidAmount = parseFloat(paidResult.rows[0].total_paid || '0');
        }

        // 5. Current Earnings = Lifetime - Paid
        // 6. Get count of orders (Legacy + Direct)
        const ordersCountQuery = `
            SELECT COUNT(acl.id) as total_orders
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE s.city ILIKE $1 AND s.state ILIKE $2
        `;
        const ordersResult = await pool.query(ordersCountQuery, [city, state]);
        let ordersFromBranch = parseInt(ordersResult.rows[0].total_orders || '0');

        if (adminId) {
            const directOrdersCountRes = await pool.query(`
                SELECT COUNT(*) as count FROM affiliate_commission_log 
                WHERE commission_source = 'area_manager' AND affiliate_user_id = $1
            `, [adminId]);
            ordersFromBranch += parseInt(directOrdersCountRes.rows[0].count || '0');
        }

        // 7. Get Recent Orders for Transparency (Merge Legacy + Direct + ASM Direct)
        // Legacy Orders (Affiliate Override)
        const recentOrdersQuery = `
            SELECT 
                acl.id,
                acl.order_id,
                acl.order_amount,
                acl.commission_amount,
                acl.created_at,
                acl.product_name,
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
        `;
        const recentOrdersResult = await pool.query(recentOrdersQuery, [city, state]);

        let allOrders = recentOrdersResult.rows;

        // Branch Override Orders (commission_source='area_manager')
        if (adminId) {
            const directOrdersQuery = `
                SELECT 
                    acl_asm.id, 
                    acl_asm.order_id, 
                    acl_asm.order_amount, 
                    acl_asm.affiliate_commission as commission_amount,
                    acl_asm.created_at, 
                    acl_asm.product_name,
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
                    ON acl_branch.affiliate_code = ba.refer_code
                WHERE acl_asm.commission_source = 'area_manager' 
                  AND acl_asm.affiliate_user_id = $1
                ORDER BY acl_asm.created_at DESC
                LIMIT 20
            `;
            const directOrdersResult = await pool.query(directOrdersQuery, [adminId, city]);
            allOrders = [...allOrders, ...directOrdersResult.rows];
        }

        // ASM Direct Referral Orders (commission_source='asm_direct')
        let earningsFromDirect = 0;
        let ordersFromDirect = 0;

        if (adminId && asmReferCode) {
            // Stats (Query by refer_code OR affiliate_user_id to be safe)
            const directRefQuery = `
                SELECT 
                    COALESCE(SUM(affiliate_commission), 0) as total,
                    COUNT(*) as count
                FROM affiliate_commission_log
                WHERE commission_source = 'asm_direct' 
                  AND (affiliate_user_id = $1 OR affiliate_code = $2)
                  AND status = 'CREDITED'
            `;
            const directRefResult = await pool.query(directRefQuery, [adminId, asmReferCode]);
            earningsFromDirect = parseFloat(directRefResult.rows[0].total || '0');
            ordersFromDirect = parseInt(directRefResult.rows[0].count || '0');

            // Orders List
            const asmDirectQuery = `
                 SELECT 
                    acl.id, 
                    acl.order_id, 
                    acl.order_amount, 
                    acl.affiliate_commission as commission_amount,
                    acl.created_at, 
                    acl.product_name,
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
            `;
            const asmDirectResult = await pool.query(asmDirectQuery, [adminId, city, asmReferCode]);
            allOrders = [...allOrders, ...asmDirectResult.rows];
        }

        // Sort all orders
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        allOrders = allOrders.slice(0, 50);

        // Calculate Totals
        const earningsFromBranch = lifetimeEarningsLegacy + directAsmEarnings;
        const totalLifetimeEarnings = earningsFromBranch + earningsFromDirect;
        const totalAllOrders = ordersFromBranch + ordersFromDirect;
        const currentEarnings = totalLifetimeEarnings - paidAmount;

        await pool.end();

        return NextResponse.json({
            success: true,
            stats: {
                totalAffiliateCommissions,
                totalOrders: totalAllOrders,
                commissionRate,
                lifetimeEarnings: totalLifetimeEarnings,
                paidAmount,
                currentEarnings,
                totalEarnings: currentEarnings,
                // Breakdown
                earningsFromBranch,
                earningsFromDirect,
                ordersFromBranch,
                ordersFromDirect
            },
            recentOrders: allOrders
        });

    } catch (error: any) {
        console.error("Failed to fetch ASM earnings:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
