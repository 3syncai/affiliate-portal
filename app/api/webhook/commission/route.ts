import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendNotification } from "@/lib/sse";

export const dynamic = "force-dynamic";

interface CommissionPayload {
    order_id: string;
    affiliate_code: string;
    product_id: string;  // Required for commission lookup
    product_name?: string;
    category_id?: string;
    collection_id?: string;
    product_type_id?: string;
    quantity: number;
    item_price: number;
    order_amount: number;
    status?: string;
    customer_id?: string;
    customer_name?: string;
    customer_email?: string;
}

// POST /api/webhook/commission
// Looks up commission from database and records affiliate commission
export async function POST(request: NextRequest) {
    try {
        const payload: CommissionPayload = await request.json();

        console.log('[Webhook] Received payload:', JSON.stringify(payload, null, 2));

        // Validate required fields
        if (!payload.order_id || !payload.affiliate_code || !payload.product_id) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: order_id, affiliate_code, product_id"
            }, { status: 400 });
        }


        // STEP 0: Enrich Payload - Fetch Category/Collection if missing
        if (!payload.category_id || !payload.collection_id) {
            try {
                // Fetch Category
                if (!payload.category_id) {
                    const catRes = await pool.query(`
                        SELECT product_category_id FROM product_category_product 
                        WHERE product_id = $1 LIMIT 1
                    `, [payload.product_id]);
                    if (catRes.rows.length > 0) {
                        payload.category_id = catRes.rows[0].product_category_id;
                        console.log(`[Enrichment] Found Category ID: ${payload.category_id}`);
                    }
                }

                // Fetch Collection
                if (!payload.collection_id) {
                    const collRes = await pool.query(`
                        SELECT collection_id FROM product WHERE id = $1
                    `, [payload.product_id]);
                    if (collRes.rows.length > 0) {
                        payload.collection_id = collRes.rows[0].collection_id;
                        console.log(`[Enrichment] Found Collection ID: ${payload.collection_id}`);
                    }
                }
            } catch (enrichErr) {
                console.error("[Enrichment] Failed to fetch product metadata:", enrichErr);
            }
        }

        // STEP 1: Lookup commission percentage from product_commissions table
        // Priority: product_id > category_id > collection_id > product_type_id
        let commissionPercentage = 0;
        let commissionSource = 'none';

        const commissionQuery = `
            SELECT commission_rate as commission_percentage, 
                   CASE 
                       WHEN product_id IS NOT NULL THEN 'product'
                       WHEN category_id IS NOT NULL THEN 'category'
                       WHEN collection_id IS NOT NULL THEN 'collection'
                       WHEN type_id IS NOT NULL THEN 'product_type'
                   END as source
            FROM affiliate_commission
            WHERE (product_id = $1)
               OR (category_id = $2 AND product_id IS NULL)
               OR (collection_id = $3 AND product_id IS NULL AND category_id IS NULL)
               OR (type_id = $4 AND product_id IS NULL AND category_id IS NULL AND collection_id IS NULL)
            ORDER BY 
                CASE 
                    WHEN product_id IS NOT NULL THEN 1
                    WHEN category_id IS NOT NULL THEN 2
                    WHEN collection_id IS NOT NULL THEN 3
                    WHEN type_id IS NOT NULL THEN 4
                END
            LIMIT 1
        `;

        const commissionResult = await pool.query(commissionQuery, [
            payload.product_id,
            payload.category_id || null,
            payload.collection_id || null,
            payload.product_type_id || null
        ]);

        if (commissionResult.rows.length > 0) {
            commissionPercentage = parseFloat(commissionResult.rows[0].commission_percentage);
            commissionSource = commissionResult.rows[0].source;
            console.log(`[Commission Lookup] Found ${commissionPercentage}% commission via ${commissionSource}`);
        } else {
            console.log('[Commission Lookup] No commission found for this product. Using default fallback (0%).');
            // FALLBACK: Don't fail, just log with 0% commission so the order is tracked
            commissionPercentage = 0;
            commissionSource = 'uncategorized_fallback';

            // Optional: You could fetch a global default from a settings table here if it existed
        }

        // STEP 2: Calculate commission amount based on price and percentage
        const commissionAmount = payload.order_amount * (commissionPercentage / 100);
        console.log(`[Commission Calculation] ${payload.order_amount} * ${commissionPercentage}% = ${commissionAmount}`);

        // STEP 3: Check Branch Admin
        const branchAdminResult = await pool.query(`
            SELECT id, refer_code, first_name, last_name, email, branch, city, state
            FROM branch_admin
            WHERE refer_code = $1
        `, [payload.affiliate_code]);

        const branchAdmin = branchAdminResult.rows.length > 0 ? branchAdminResult.rows[0] : null;

        // STEP 3.5: Check ASM (Area Sales Manager)
        const asmResult = await pool.query(`
            SELECT id, refer_code, first_name, last_name, email, city, state
            FROM area_sales_manager
            WHERE refer_code = $1
        `, [payload.affiliate_code]);

        const asm = asmResult.rows.length > 0 ? asmResult.rows[0] : null;

        // Process Branch Admin and Hierarchy
        if (branchAdmin) {
            console.log(`[Branch Admin Referral] ${branchAdmin.first_name} ${branchAdmin.last_name} (${branchAdmin.branch})`);

            // --- A) Process Branch Admin Commission (Level 1) ---
            const affiliateRateResult = await pool.query(`
                SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'
            `);
            const branchDirectRateResult = await pool.query(`
                SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'
            `);

            const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '70');
            const bonusRate = parseFloat(branchDirectRateResult.rows[0]?.commission_percentage || '15');
            const affiliateRate = baseRate + bonusRate; // 85%
            const affiliateCommission = commissionAmount * (affiliateRate / 100);

            // DEDUPLICATION CHECK: Check if commission already logged (e.g. by Storefront)
            const existingCheck = await pool.query(`
                SELECT id, status FROM affiliate_commission_log 
                WHERE order_id = $1 AND product_name = $2 AND affiliate_code = $3
            `, [payload.order_id, payload.product_name, payload.affiliate_code]);

            if (existingCheck.rows.length === 0) {
                // Insert Branch Admin Commission
                await pool.query(`
                    INSERT INTO affiliate_commission_log (
                        order_id, affiliate_code, affiliate_user_id, product_name, quantity, item_price, order_amount,
                        commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                        commission_source, status, customer_id, customer_name, customer_email, 
                        product_id, category_id, collection_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                `, [
                    payload.order_id, payload.affiliate_code, branchAdmin.id, payload.product_name || 'Product',
                    payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                    commissionPercentage, commissionAmount, affiliateRate, affiliateCommission,
                    'branch_admin', 'PENDING',
                    payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                    payload.product_id, payload.category_id || null, payload.collection_id || null
                ]);
                console.log(`[Hierarchy] Logged Level 1 (Branch Admin) Commission: ₹${affiliateCommission}`);

                // NOTIFY Branch Admin
                sendNotification(payload.affiliate_code, {
                    type: 'stats_update',
                    message: `New Commission: ₹${affiliateCommission.toFixed(2)}`,
                    amount: affiliateCommission
                });


            } else {
                console.log(`[Hierarchy] Level 1 Commission already exists, checking for status update.`);

                // UPDATE STATUS if changing from PENDING to CREDITED
                const currentStatus = existingCheck.rows[0]?.status; // Need to select status in check query
                if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                    await pool.query(`
                        UPDATE affiliate_commission_log 
                        SET status = 'CREDITED', credited_at = NOW()
                        WHERE id = $1
                    `, [existingCheck.rows[0].id]);

                    // Credit Wallet logic
                    await pool.query(`
                        INSERT INTO customer_wallet (customer_id, coins_balance)
                        SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                        ON CONFLICT (customer_id) 
                        DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                    `, [payload.affiliate_code, affiliateCommission]);

                    console.log(`[Hierarchy] Updated Level 1 Commission to CREDITED.`);

                    // NOTIFY Branch Admin
                    sendNotification(payload.affiliate_code, {
                        type: 'stats_update',
                        message: `Commission Credited: ₹${affiliateCommission.toFixed(2)}`,
                        amount: affiliateCommission
                    });
                }
            }

            // --- B) Process Area Manager Commission (Level 2) ---
            if (branchAdmin.city && branchAdmin.state) {
                const areaManagerRes = await pool.query(`
                    SELECT id, first_name, last_name, email FROM area_sales_manager
                    WHERE city = $1 AND state = $2
                `, [branchAdmin.city, branchAdmin.state]);

                if (areaManagerRes.rows.length > 0) {
                    const areaManager = areaManagerRes.rows[0];
                    const areaRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
                    const areaRate = parseFloat(areaRateRes.rows[0]?.commission_percentage || '10'); // 10%

                    const areaCommission = commissionAmount * (areaRate / 100);

                    // Check duplicate for Area Manager
                    const areaCheck = await pool.query(`
                        SELECT id FROM affiliate_commission_log 
                        WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'area_manager'
                    `, [payload.order_id, payload.product_name, areaManager.email]);

                    if (areaCheck.rows.length === 0) {
                        await pool.query(`
                            INSERT INTO affiliate_commission_log (
                                order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                commission_source, status, customer_id, customer_name, customer_email, 
                                product_id, category_id, collection_id, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                        `, [
                            payload.order_id,
                            'AREA', // Placeholder code for Area Manager log
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, areaRate, areaCommission,
                            'area_manager', payload.status || 'PENDING',
                            payload.customer_id || null, // Added customer_id
                            `${areaManager.first_name} ${areaManager.last_name}`, areaManager.email,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[Hierarchy] Logged Level 2 (Area Manager) Commission: ₹${areaCommission} for ${areaManager.first_name}`);
                        // Note: Area Manager Wallet credit logic would go here if they have a wallet system
                    }
                }
            }

            // --- C) Process State Admin Commission (Level 3) ---
            if (branchAdmin.state) {
                const stateAdminRes = await pool.query(`
                    SELECT id, first_name, last_name, email FROM state_admin
                    WHERE state = $1
                `, [branchAdmin.state]);

                if (stateAdminRes.rows.length > 0) {
                    const stateAdmin = stateAdminRes.rows[0];
                    const stateRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);
                    const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '5'); // 5%

                    const stateCommission = commissionAmount * (stateRate / 100);

                    // Check duplicate for State Admin
                    const stateCheck = await pool.query(`
                        SELECT id FROM affiliate_commission_log 
                        WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'state_admin'
                    `, [payload.order_id, payload.product_name, stateAdmin.email]);

                    if (stateCheck.rows.length === 0) {
                        await pool.query(`
                            INSERT INTO affiliate_commission_log (
                                order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                commission_source, status, customer_id, customer_name, customer_email, 
                                product_id, category_id, collection_id, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                        `, [
                            payload.order_id,
                            'STATE', // Placeholder code
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, stateRate, stateCommission,
                            'state_admin', payload.status || 'PENDING',
                            payload.customer_id || null, // Added customer_id
                            `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[Hierarchy] Logged Level 3 (State Admin) Commission: ₹${stateCommission} for ${stateAdmin.first_name}`);
                    }
                }
            }

        } else if (asm) {
            // ... (ASM Logic remains the same) ...
            console.log(`[ASM Referral] ${asm.first_name} ${asm.last_name} (${asm.city}, ${asm.state})`);

            const affiliateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
            const branchRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
            const asmRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);

            const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '70');
            const branchBonus = parseFloat(branchRateResult.rows[0]?.commission_percentage || '15');
            const asmBonus = parseFloat(asmRateResult.rows[0]?.commission_percentage || '10');
            const totalRate = baseRate + branchBonus + asmBonus; // 95%
            const asmCommission = commissionAmount * (totalRate / 100);

            // Deduplication check
            const existingCheck = await pool.query(`
                SELECT id, status FROM affiliate_commission_log 
                WHERE order_id = $1 AND product_name = $2 AND affiliate_code = $3
            `, [payload.order_id, payload.product_name, payload.affiliate_code]);

            if (existingCheck.rows.length === 0) {
                await pool.query(`
                    INSERT INTO affiliate_commission_log (
                        order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                        commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                        commission_source, status, customer_id, customer_name, customer_email, 
                        product_id, category_id, collection_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                `, [
                    payload.order_id, payload.affiliate_code, payload.product_name || 'Product',
                    payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                    commissionPercentage, commissionAmount, totalRate, asmCommission,
                    'asm_direct', 'PENDING',
                    payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                    payload.product_id, payload.category_id || null, payload.collection_id || null
                ]);
                if (payload.status === 'CREDITED' || payload.status === 'COMPLETED') {
                    // ASM Wallet Credit Logic (if applicable)
                }

            } else {
                // UPDATE STATUS for ASM
                const currentStatus = existingCheck.rows[0]?.status;
                if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                    await pool.query(`
                        UPDATE affiliate_commission_log 
                        SET status = 'CREDITED', credited_at = NOW()
                        WHERE id = $1
                    `, [existingCheck.rows[0].id]);
                    console.log(`[ASM Direct] Updated to CREDITED.`);
                }
            }

            // --- State Admin Commission for ASM Direct Referral (5%) ---
            if (asm.state) {
                const stateAdminRes = await pool.query(`
                    SELECT id, first_name, last_name, email FROM state_admin
                    WHERE state = $1
                `, [asm.state]);

                if (stateAdminRes.rows.length > 0) {
                    const stateAdmin = stateAdminRes.rows[0];
                    const stateRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);
                    const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '5');

                    const stateCommission = commissionAmount * (stateRate / 100);

                    // Check duplicate for State Admin
                    const stateCheck = await pool.query(`
                        SELECT id FROM affiliate_commission_log 
                        WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'state_admin'
                    `, [payload.order_id, payload.product_name, stateAdmin.email]);

                    if (stateCheck.rows.length === 0) {
                        await pool.query(`
                            INSERT INTO affiliate_commission_log (
                                order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                commission_source, status, customer_id, customer_name, customer_email, 
                                product_id, category_id, collection_id, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                        `, [
                            payload.order_id,
                            'STATE', // Placeholder code
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, stateRate, stateCommission,
                            'state_admin', payload.status || 'PENDING',
                            payload.customer_id || null,
                            `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[State Admin] Logged Commission: ₹${stateCommission} for ${stateAdmin.first_name} (ASM referral)`);
                    }
                }
            }

        } else {
            // STEP 3.6: Check State Admin Direct
            const stateAdminResult = await pool.query(`
                SELECT id, refer_code, first_name, last_name, email, state
                FROM state_admin
                WHERE refer_code = $1
            `, [payload.affiliate_code]);

            const stateAdmin = stateAdminResult.rows.length > 0 ? stateAdminResult.rows[0] : null;

            if (stateAdmin) {
                // State Admin Direct Referral - Gets 100% (70+15+10+5)
                console.log(`[State Admin Referral] ${stateAdmin.first_name} ${stateAdmin.last_name} (${stateAdmin.state})`);

                const affiliateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
                const branchRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
                const asmRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
                const stateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);

                const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '70');
                const branchBonus = parseFloat(branchRateResult.rows[0]?.commission_percentage || '15');
                const asmBonus = parseFloat(asmRateResult.rows[0]?.commission_percentage || '10');
                const stateBonus = parseFloat(stateRateResult.rows[0]?.commission_percentage || '5');

                const totalRate = baseRate + branchBonus + asmBonus + stateBonus; // ~100%
                const stateCommission = commissionAmount * (totalRate / 100);

                // Deduplication check
                const existingCheck = await pool.query(`
                    SELECT id FROM affiliate_commission_log 
                    WHERE order_id = $1 AND product_name = $2 AND affiliate_code = $3
                `, [payload.order_id, payload.product_name, payload.affiliate_code]);

                // UPDATE STATUS for State Admin Direct
                if (existingCheck.rows.length > 0) {
                    const currentStatus = existingCheck.rows[0]?.status;
                    if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                        await pool.query(`
                            UPDATE affiliate_commission_log 
                            SET status = 'CREDITED', credited_at = NOW()
                            WHERE id = $1
                        `, [existingCheck.rows[0].id]);

                        console.log(`[State Admin Direct] Updated to CREDITED.`);


                    }
                }

                if (existingCheck.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO affiliate_commission_log (
                            order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                            commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                            commission_source, status, customer_id, customer_name, customer_email, 
                            product_id, category_id, collection_id, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                    `, [
                        payload.order_id, payload.affiliate_code, payload.product_name || 'Product',
                        payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                        commissionPercentage, commissionAmount, totalRate, stateCommission,
                        'state_admin_direct', 'PENDING',
                        payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                        payload.product_id, payload.category_id || null, payload.collection_id || null
                    ]);
                    console.log(`[State Admin Direct] Logged Commission: ₹${stateCommission} at ${totalRate}%`);


                }

            } else {
                // Regular Affiliate (Non-Branch/ASM/State)
                // Flow: Affiliate (70%) -> Branch (15%) -> ASM (10%) -> State (5%)

                // 1. Fetch Affiliate Details to find their location/branch
                const affiliateUserRes = await pool.query(`
                    SELECT id, branch, area, city, state 
                    FROM affiliate_user 
                    WHERE refer_code = $1
                `, [payload.affiliate_code]);

                const affiliateUser = affiliateUserRes.rows.length > 0 ? affiliateUserRes.rows[0] : null;

                // --- A) Pay Affiliate (70%) ---
                const rateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
                const affiliateRate = parseFloat(rateResult.rows[0]?.commission_percentage || '70');
                const affiliateCommission = commissionAmount * (affiliateRate / 100);

                // Deduplication check
                const existingCheck = await pool.query(`
                    SELECT id, status FROM affiliate_commission_log 
                    WHERE order_id = $1 AND product_name = $2 AND affiliate_code = $3
                `, [payload.order_id, payload.product_name, payload.affiliate_code]);

                if (existingCheck.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO affiliate_commission_log (
                            order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                            commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                            commission_source, status, customer_id, customer_name, customer_email, 
                            product_id, category_id, collection_id, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                    `, [
                        payload.order_id, payload.affiliate_code, payload.product_name || 'Product',
                        payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                        commissionPercentage, commissionAmount, affiliateRate, affiliateCommission,
                        'affiliate', 'PENDING',
                        payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                        payload.product_id, payload.category_id || null, payload.collection_id || null
                    ]);


                    console.log(`[Affiliate] Logged Base Commission: ₹${affiliateCommission}`);
                } else {
                    // UPDATE STATUS
                    const currentStatus = existingCheck.rows[0]?.status;
                    if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                        await pool.query(`
                            UPDATE affiliate_commission_log 
                            SET status = 'CREDITED', credited_at = NOW()
                            WHERE id = $1
                        `, [existingCheck.rows[0].id]);

                        await pool.query(`
                            INSERT INTO customer_wallet (customer_id, coins_balance)
                            SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                            ON CONFLICT (customer_id) 
                            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                        `, [payload.affiliate_code, affiliateCommission]);

                        console.log(`[Affiliate] Updated to CREDITED.`);
                    }
                }

                // --- B) Pay Branch Admin Override (15%) ---
                if (affiliateUser && affiliateUser.branch) {
                    const branchAdminRes = await pool.query(`
                        SELECT id, first_name, last_name, email, city, state, refer_code FROM branch_admin
                        WHERE branch = $1
                    `, [affiliateUser.branch]);

                    if (branchAdminRes.rows.length > 0) {
                        const branchAdmin = branchAdminRes.rows[0];
                        const brRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
                        const brRate = parseFloat(brRateRes.rows[0]?.commission_percentage || '15');
                        const brCommission = commissionAmount * (brRate / 100);

                        const brCheck = await pool.query(`
                            SELECT id, status FROM affiliate_commission_log 
                            WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'branch_admin'
                        `, [payload.order_id, payload.product_name, branchAdmin.email]);

                        if (brCheck.rows.length === 0) {
                            await pool.query(`
                                INSERT INTO affiliate_commission_log (
                                    order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                    commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                    commission_source, status, customer_id, customer_name, customer_email,
                                    affiliate_user_id, product_id, category_id, collection_id, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                            `, [
                                payload.order_id, 'BRANCH', payload.product_name || 'Product',
                                payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                                commissionPercentage, commissionAmount, brRate, brCommission,
                                'branch_admin', payload.status || 'PENDING',
                                payload.customer_id || null,
                                `${branchAdmin.first_name} ${branchAdmin.last_name}`, branchAdmin.email,
                                branchAdmin.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged Branch Override: ₹${brCommission}`);

                            // NOTIFY Branch Admin (Override)
                            sendNotification(branchAdmin.refer_code, {
                                type: 'stats_update',
                                message: `New Override Commission: ₹${brCommission.toFixed(2)}`,
                                amount: brCommission
                            });


                        } else {
                            // UPDATE STATUS for Branch Admin
                            const currentStatus = brCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                                await pool.query(`
                                    UPDATE affiliate_commission_log 
                                    SET status = 'CREDITED', credited_at = NOW()
                                    WHERE id = $1
                                `, [brCheck.rows[0].id]);

                                await pool.query(`
                                    INSERT INTO customer_wallet (customer_id, coins_balance)
                                    SELECT id, $2 FROM branch_admin WHERE email = $1
                                    ON CONFLICT (customer_id) 
                                    DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                                `, [branchAdmin.email, brCommission]);

                                console.log(`[Hierarchy] Updated Branch Admin to CREDITED.`);

                                // NOTIFY Branch Admin (Override Credited)
                                sendNotification(branchAdmin.refer_code, {
                                    type: 'stats_update',
                                    message: `Override Commission Credited: ₹${brCommission.toFixed(2)}`,
                                    amount: brCommission
                                });
                            }
                        }
                    }
                }

                // --- C) Pay ASM Override (10%) ---
                // Try to find ASM via Branch Location, else Affiliate Location
                const cityTarget = affiliateUser?.city;
                const stateTarget = affiliateUser?.state;

                if (cityTarget && stateTarget) {
                    const asmRes = await pool.query(`
                        SELECT id, first_name, last_name, email FROM area_sales_manager
                        WHERE city = $1 AND state = $2
                    `, [cityTarget, stateTarget]);

                    if (asmRes.rows.length > 0) {
                        const asm = asmRes.rows[0];
                        const areaRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
                        const areaRate = parseFloat(areaRateRes.rows[0]?.commission_percentage || '10');
                        const areaCommission = commissionAmount * (areaRate / 100);

                        const areaCheck = await pool.query(`
                            SELECT id, status FROM affiliate_commission_log 
                            WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'area_manager'
                        `, [payload.order_id, payload.product_name, asm.email]);

                        if (areaCheck.rows.length === 0) {
                            await pool.query(`
                                INSERT INTO affiliate_commission_log (
                                    order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                    commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                    commission_source, status, customer_id, customer_name, customer_email,
                                    affiliate_user_id, product_id, category_id, collection_id, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                            `, [
                                payload.order_id, 'AREA', payload.product_name || 'Product',
                                payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                                commissionPercentage, commissionAmount, areaRate, areaCommission,
                                'area_manager', payload.status || 'PENDING',
                                payload.customer_id || null,
                                `${asm.first_name} ${asm.last_name}`, asm.email,
                                asm.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged ASM Override: ₹${areaCommission}`);


                        } else {
                            const currentStatus = areaCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                                await pool.query(`
                                    UPDATE affiliate_commission_log 
                                    SET status = 'CREDITED', credited_at = NOW()
                                    WHERE id = $1
                                `, [areaCheck.rows[0].id]);

                                await pool.query(`
                                    INSERT INTO customer_wallet (customer_id, coins_balance)
                                    SELECT id, $2 FROM area_sales_manager WHERE email = $1
                                    ON CONFLICT (customer_id) 
                                    DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                                `, [asm.email, areaCommission]);

                                console.log(`[Hierarchy] Updated ASM to CREDITED.`);
                            }
                        }
                    }
                }

                // --- D) Pay State Admin Override (5%) ---
                if (stateTarget) {
                    const stateAdminRes = await pool.query(`
                        SELECT id, first_name, last_name, email FROM state_admin
                        WHERE state = $1
                    `, [stateTarget]);

                    if (stateAdminRes.rows.length > 0) {
                        const stateAdmin = stateAdminRes.rows[0];
                        const stateRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);
                        const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '5');
                        const stateCommission = commissionAmount * (stateRate / 100);

                        const stateCheck = await pool.query(`
                            SELECT id, status FROM affiliate_commission_log 
                            WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'state_admin'
                        `, [payload.order_id, payload.product_name, stateAdmin.email]);

                        if (stateCheck.rows.length === 0) {
                            await pool.query(`
                                INSERT INTO affiliate_commission_log (
                                    order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                    commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                    commission_source, status, customer_id, customer_name, customer_email,
                                    affiliate_user_id, product_id, category_id, collection_id, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                            `, [
                                payload.order_id, 'STATE', payload.product_name || 'Product',
                                payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                                commissionPercentage, commissionAmount, stateRate, stateCommission,
                                'state_admin', payload.status || 'PENDING',
                                payload.customer_id || null,
                                `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                                stateAdmin.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged State Override: ₹${stateCommission}`);


                        } else {
                            const currentStatus = stateCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && (payload.status === 'CREDITED' || payload.status === 'COMPLETED')) {
                                await pool.query(`
                                    UPDATE affiliate_commission_log 
                                    SET status = 'CREDITED', credited_at = NOW()
                                    WHERE id = $1
                                `, [stateCheck.rows[0].id]);

                                await pool.query(`
                                    INSERT INTO customer_wallet (customer_id, coins_balance)
                                    SELECT id, $2 FROM state_admin WHERE email = $1
                                    ON CONFLICT (customer_id) 
                                    DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                                `, [stateAdmin.email, stateCommission]);

                                console.log(`[Hierarchy] Updated State Admin to CREDITED.`);
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            hierarchy_applied: !!branchAdmin,
            asm_referral: !!asm,
            message: "Commission processed successfully"
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Commission recording failed:", err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
