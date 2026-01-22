import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

interface CommissionPayload {
    order_id: string;
    affiliate_code: string;
    product_name: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    commission_rate: number;
    commission_amount: number;  // Full commission before affiliate cut
    commission_source: string;
    status?: string;
    customer_id?: string;
    customer_name?: string;  // NEW: Customer display name
    customer_email?: string; // NEW: Customer email address
}

// POST /api/webhook/commission
// Records affiliate commission with proper affiliate rate deduction
export async function POST(request: NextRequest) {
    try {
        const payload: CommissionPayload = await request.json();

        // Validate required fields
        if (!payload.order_id || !payload.affiliate_code || !payload.commission_amount) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: order_id, affiliate_code, commission_amount"
            }, { status: 400 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: false
        });

        // Check if this is a branch admin referral
        const branchAdminCheck = await pool.query(`
            SELECT ba.id, ba.refer_code, ba.first_name, ba.last_name, ba.branch, ba.city, ba.state
            FROM branch_admin ba
            INNER JOIN affiliate_referrals ar ON ba.refer_code = ar.affiliate_code
            WHERE ba.refer_code = $1 AND ar.customer_id = $2 AND ba.is_active = true
        `, [payload.affiliate_code, payload.customer_id]);

        const isBranchAdminReferral = branchAdminCheck.rows.length > 0;
        let affiliateRate: number;

        if (isBranchAdminReferral) {
            // Branch admin gets affiliate rate (70%) + branch rate (15%) = 85%
            const affiliateRateResult = await pool.query(`
                SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'
            `);
            const branchRateResult = await pool.query(`
                SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'  
            `);

            const affiliatePct = affiliateRateResult.rows[0]?.commission_percentage || 70;
            const branchPct = branchRateResult.rows[0]?.commission_percentage || 15;

            affiliateRate = parseFloat(affiliatePct) + parseFloat(branchPct); // 85%
            console.log(`[Commission] Branch admin referral detected: ${payload.affiliate_code}, rate: ${affiliateRate}%`);
        } else {
            // Regular affiliate gets their standard rate (70%)
            const rateResult = await pool.query(`
                SELECT commission_percentage 
                FROM commission_rates 
                WHERE role_type = 'affiliate'
            `);
            affiliateRate = rateResult.rows.length > 0
                ? parseFloat(rateResult.rows[0].commission_percentage)
                : 70; // Default to 70%
            console.log(`[Commission] Affiliate referral detected: ${payload.affiliate_code}, rate: ${affiliateRate}%`);
        }

        // Calculate affiliate's actual commission
        const affiliateCommission = payload.commission_amount * (affiliateRate / 100);

        // Insert commission log with branch admin tracking
        const insertResult = await pool.query(`
            INSERT INTO affiliate_commission_log (
                order_id,
                affiliate_code,
                is_branch_admin_referral,
                branch_admin_code,
                product_name,
                quantity,
                item_price,
                order_amount,
                commission_rate,
                commission_amount,
                affiliate_rate,
                affiliate_commission,
                commission_source,
                status,
                customer_id,
                customer_name,
                customer_email,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
            RETURNING id
        `, [
            payload.order_id,
            payload.affiliate_code,
            isBranchAdminReferral,
            isBranchAdminReferral ? payload.affiliate_code : null,
            payload.product_name || 'Product',
            payload.quantity || 1,
            payload.item_price || 0,
            payload.order_amount || 0,
            payload.commission_rate || 0,
            payload.commission_amount,  // Full commission before split
            affiliateRate,              // 85% for branch admin, 70% for affiliate
            affiliateCommission,        // Actual earnings
            payload.commission_source || 'order',
            payload.status || 'PENDING',  // Default to PENDING, will be CREDITED after delivery
            payload.customer_id || null,
            payload.customer_name || null,
            payload.customer_email || null
        ]);

        // DO NOT update wallet here - wallet will only be updated when commission status changes to CREDITED after delivery
        // This ensures affiliates only get paid for delivered products

        // Log commission activity for hierarchical notifications
        try {
            // Get affiliate details for activity log
            const affiliateResult = await pool.query(`
                SELECT id, first_name, last_name, branch, city, state
                FROM affiliate_user
                WHERE refer_code = $1
            `, [payload.affiliate_code]);

            if (affiliateResult.rows.length > 0) {
                const affiliate = affiliateResult.rows[0];
                const affiliateName = `${affiliate.first_name} ${affiliate.last_name}`;

                await pool.query(`
                    INSERT INTO activity_log 
                    (activity_type, actor_id, actor_name, actor_role, actor_branch, actor_area, actor_state,
                     target_id, target_name, target_type, amount, product_name, description, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    'commission_earned',
                    affiliate.id,
                    affiliateName,
                    'branch',  // Affiliate activity logged at branch level
                    affiliate.branch,
                    affiliate.city,  // Area is the city
                    affiliate.state,
                    payload.order_id,
                    payload.product_name,
                    'order',
                    affiliateCommission,
                    payload.product_name,
                    `affiliate ${affiliateName} earned ₹${affiliateCommission.toFixed(2)} commission on ${payload.product_name}`,
                    JSON.stringify({
                        orderId: payload.order_id,
                        customerId: payload.customer_id,
                        customerName: payload.customer_name
                    })
                ]);
            }
        } catch (err) {
            console.log("Failed to log commission activity:", err);
            // Don't fail the whole request if activity logging fails
        }

        await pool.end();

        return NextResponse.json({
            success: true,
            data: {
                id: insertResult.rows[0].id,
                fullCommission: payload.commission_amount,
                affiliateRate: affiliateRate,
                affiliateCommission: affiliateCommission,
                platformFee: payload.commission_amount - affiliateCommission
            }
        });

    } catch (error: any) {
        console.error("Commission recording failed:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
