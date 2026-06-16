import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendNotification } from "@/lib/sse";
import { normalizeCommissionStatus } from "@/lib/commission-status";
import { applyAdditionalCommissionForOrder } from "@/lib/additional-commission";
import { resolveBranchAdminForSale } from "@/lib/repair-branch-admin-commissions";

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

// POST /api/webhook/commissionagai
// Looks up commission from database and records affiliate commission
export async function POST(request: NextRequest) {
    try {
        const payload: CommissionPayload = await request.json();

        console.log('[Webhook] Received payload:', JSON.stringify(payload, null, 2));

        // Normalize key identifiers early so lookups and dedupe stay stable.
        payload.order_id = String(payload.order_id || "").trim();
        payload.affiliate_code = String(payload.affiliate_code || "").trim();
        payload.product_id = String(payload.product_id || "").trim();
        payload.product_name = payload.product_name ? String(payload.product_name).trim() : payload.product_name;

        // Validate required fields
        if (!payload.order_id || !payload.affiliate_code || !payload.product_id) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: order_id, affiliate_code, product_id"
            }, { status: 400 });
        }


        // STEP 0: Enrich Payload - Fetch ALL Categories (including ancestors), Collection, and Type
        // Products can belong to multiple categories (especially combo/bundle products).
        // We must consider EVERY category the product is linked to — direct AND ancestor —
        // so a commission rule on a parent category (e.g. "Health Care") still applies
        // to products tagged only with its subcategory ("Sassiest Health Care").
        let productCategoryIds: string[] = [];
        try {
            // Fetch every category the product is directly linked to, plus the full
            // ancestor chain via parent_category_id.
            const catRes = await pool.query(`
                WITH RECURSIVE category_tree AS (
                    SELECT pc.id, pc.parent_category_id
                    FROM product_category_product pcp
                    JOIN product_category pc ON pc.id = pcp.product_category_id
                    WHERE pcp.product_id = $1

                    UNION

                    SELECT parent.id, parent.parent_category_id
                    FROM product_category parent
                    JOIN category_tree ct ON ct.parent_category_id = parent.id
                )
                SELECT DISTINCT id FROM category_tree
            `, [payload.product_id]);
            productCategoryIds = catRes.rows.map(r => r.id).filter(Boolean);

            // If the storefront passed a specific category_id, make sure it's included
            if (payload.category_id && !productCategoryIds.includes(payload.category_id)) {
                productCategoryIds.push(payload.category_id);
            }

            // Pick a representative category_id for logging/ledger columns
            if (!payload.category_id && productCategoryIds.length > 0) {
                payload.category_id = productCategoryIds[0];
            }

            console.log(`[Enrichment] Product belongs to ${productCategoryIds.length} categor${productCategoryIds.length === 1 ? "y" : "ies"} (incl. ancestors): [${productCategoryIds.join(", ")}]`);

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

            // Fetch Product Type
            if (!payload.product_type_id) {
                const typeRes = await pool.query(`
                    SELECT type_id FROM product WHERE id = $1
                `, [payload.product_id]);
                if (typeRes.rows.length > 0 && typeRes.rows[0].type_id) {
                    payload.product_type_id = typeRes.rows[0].type_id;
                    console.log(`[Enrichment] Found Type ID: ${payload.product_type_id}`);
                }
            }
        } catch (enrichErr) {
            console.error("[Enrichment] Failed to fetch product metadata:", enrichErr);
        }

        // STEP 1: Lookup commission percentage from affiliate_commission table
        // Priority: product_id > category (ANY of the product's categories or ancestors)
        //          > collection_id > product_type_id
        let commissionPercentage = 0;
        const commissionQuery = `
            SELECT commission_rate as commission_percentage,
                   product_id, category_id, collection_id, type_id,
                   CASE 
                       WHEN product_id IS NOT NULL THEN 'product'
                       WHEN category_id IS NOT NULL THEN 'category'
                       WHEN collection_id IS NOT NULL THEN 'collection'
                       WHEN type_id IS NOT NULL THEN 'product_type'
                   END as source
            FROM affiliate_commission
            WHERE (product_id = $1)
               OR (category_id = ANY($2::text[]) AND product_id IS NULL)
               OR (collection_id = $3 AND product_id IS NULL AND category_id IS NULL)
               OR (type_id = $4 AND product_id IS NULL AND category_id IS NULL AND collection_id IS NULL)
            ORDER BY 
                CASE 
                    WHEN product_id IS NOT NULL THEN 1
                    WHEN category_id IS NOT NULL THEN 2
                    WHEN collection_id IS NOT NULL THEN 3
                    WHEN type_id IS NOT NULL THEN 4
                END,
                commission_rate DESC
            LIMIT 1
        `;

        const commissionResult = await pool.query(commissionQuery, [
            payload.product_id,
            productCategoryIds.length > 0 ? productCategoryIds : [null],
            payload.collection_id || null,
            payload.product_type_id || null
        ]);

        if (commissionResult.rows.length > 0) {
            commissionPercentage = parseFloat(commissionResult.rows[0].commission_percentage);
            const row = commissionResult.rows[0];
            // Record the actually matched category on the ledger for clarity
            if (row.source === "category" && row.category_id) {
                payload.category_id = row.category_id;
            }
            console.log(`[Commission Lookup] Found ${commissionPercentage}% commission via ${row.source}${row.category_id ? ` (category=${row.category_id})` : ""}`);
        } else {
            console.log(`[Commission Lookup] No commission found for product=${payload.product_id}, categories=[${productCategoryIds.join(", ")}], collection=${payload.collection_id}, type=${payload.product_type_id}. Using fallback 0%.`);
            commissionPercentage = 0;
        }

        // STEP 2: Calculate commission amount based on price and percentage
        const commissionAmount = payload.order_amount * (commissionPercentage / 100);
        console.log(`[Commission Calculation] ${payload.order_amount} * ${commissionPercentage}% = ${commissionAmount}`);

        const commissionStatus = normalizeCommissionStatus(payload.status);
        const shouldCreditCommission = commissionStatus === "CREDITED";
        console.log(`[Commission Status] Incoming status "${payload.status || "PENDING"}" normalized to ${commissionStatus}`);

        // STEP 3: Check Branch Admin
        const branchAdminResult = await pool.query(`
            SELECT id, refer_code, first_name, last_name, email, branch, city, state
            FROM branch_admin
            WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1))
        `, [payload.affiliate_code]);

        const branchAdmin = branchAdminResult.rows.length > 0 ? branchAdminResult.rows[0] : null;

        // STEP 3.5: Check ASM (Area Sales Manager)
        const asmResult = await pool.query(`
            SELECT id, refer_code, first_name, last_name, email, city, state
            FROM area_sales_manager
            WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1))
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

            const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '0');
            const bonusRate = parseFloat(branchDirectRateResult.rows[0]?.commission_percentage || '0');
            const affiliateRate = baseRate + bonusRate; // e.g. 70 + 15 = 85%
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
                    'branch_admin', commissionStatus,
                    payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                    payload.product_id, payload.category_id || null, payload.collection_id || null
                ]);
                console.log(`[Hierarchy] Logged Level 1 (Branch Admin) Commission: ₹${affiliateCommission}`);

                if (shouldCreditCommission) {
                    await pool.query(`
                        INSERT INTO customer_wallet (customer_id, coins_balance)
                        SELECT id, $2 FROM branch_admin WHERE id = $1
                        ON CONFLICT (customer_id)
                        DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                    `, [branchAdmin.id, affiliateCommission]);
                }

                // NOTIFY Branch Admin
                sendNotification(payload.affiliate_code, {
                    type: 'stats_update',
                    message: commissionStatus === "CREDITED"
                        ? `Commission Credited: ₹${affiliateCommission.toFixed(2)}`
                        : `Commission Pending: ₹${affiliateCommission.toFixed(2)}`,
                    amount: affiliateCommission
                });


            } else {
                console.log(`[Hierarchy] Level 1 Commission already exists, checking for status update.`);

                // UPDATE STATUS if changing from PENDING to CREDITED
                const currentStatus = existingCheck.rows[0]?.status; // Need to select status in check query
                if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
                    await pool.query(`
                        UPDATE affiliate_commission_log 
                        SET status = 'CREDITED', credited_at = NOW()
                        WHERE id = $1
                    `, [existingCheck.rows[0].id]);

                    // Credit Wallet logic
                    await pool.query(`
                        INSERT INTO customer_wallet (customer_id, coins_balance)
                        SELECT id, $2 FROM branch_admin WHERE id = $1
                        ON CONFLICT (customer_id)
                        DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                    `, [branchAdmin.id, affiliateCommission]);

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
                    SELECT id, refer_code, first_name, last_name, email FROM area_sales_manager
                    WHERE city = $1 AND state = $2
                `, [branchAdmin.city, branchAdmin.state]);

                if (areaManagerRes.rows.length > 0) {
                    const areaManager = areaManagerRes.rows[0];
                    const areaRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
                    const areaRate = parseFloat(areaRateRes.rows[0]?.commission_percentage || '0'); 

                    const areaCommission = commissionAmount * (areaRate / 100);

                    // Check duplicate for Area Manager
                    const areaCheck = await pool.query(`
                        SELECT id, status FROM affiliate_commission_log 
                        WHERE order_id = $1 AND product_name = $2 AND customer_email = $3 AND commission_source = 'area_manager'
                    `, [payload.order_id, payload.product_name, areaManager.email]);

                    if (areaCheck.rows.length === 0) {
                        await pool.query(`
                            INSERT INTO affiliate_commission_log (
                                order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                                commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                                commission_source, status, customer_id, customer_name, customer_email, 
                                affiliate_user_id, product_id, category_id, collection_id, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
                        `, [
                            payload.order_id,
                            areaManager.refer_code || 'AREA',
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, areaRate, areaCommission,
                            'area_manager', commissionStatus,
                            payload.customer_id || null, // Added customer_id
                            `${areaManager.first_name} ${areaManager.last_name}`, areaManager.email,
                            areaManager.id,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[Hierarchy] Logged Level 2 (Area Manager) Commission: ₹${areaCommission} for ${areaManager.first_name}`);
                        // Note: Area Manager Wallet credit logic would go here if they have a wallet system
                    } else {
                        // Ensure existing rows are linked to the right ASM identity
                        await pool.query(`
                            UPDATE affiliate_commission_log
                            SET affiliate_user_id = COALESCE(affiliate_user_id, $2),
                                affiliate_code = CASE
                                    WHEN affiliate_code IS NULL
                                      OR TRIM(affiliate_code) = ''
                                      OR UPPER(TRIM(affiliate_code)) = 'AREA'
                                    THEN $3
                                    ELSE affiliate_code
                                END
                            WHERE id = $1
                        `, [areaCheck.rows[0].id, areaManager.id, areaManager.refer_code || 'AREA']);

                        const currentStatus = areaCheck.rows[0]?.status;
                        if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
                            await pool.query(`
                                UPDATE affiliate_commission_log
                                SET status = 'CREDITED', credited_at = NOW()
                                WHERE id = $1
                            `, [areaCheck.rows[0].id]);
                        }
                    }
                }
            }

            // --- C) Process State Admin Commission (Level 3) ---
            if (branchAdmin.state) {
                const stateAdminRes = await pool.query(`
                    SELECT id, refer_code, first_name, last_name, email FROM state_admin
                    WHERE state = $1
                `, [branchAdmin.state]);

                if (stateAdminRes.rows.length > 0) {
                    const stateAdmin = stateAdminRes.rows[0];
                    const stateRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);
                    const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '0'); 

                    const stateCommission = commissionAmount * (stateRate / 100);

                    // Check duplicate for State Admin
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
                            payload.order_id,
                            stateAdmin.refer_code || 'STATE',
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, stateRate, stateCommission,
                            'state_admin', commissionStatus,
                            payload.customer_id || null, // Added customer_id
                            `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                            stateAdmin.id,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[Hierarchy] Logged Level 3 (State Admin) Commission: ₹${stateCommission} for ${stateAdmin.first_name}`);
                    } else {
                        // Ensure existing rows are linked to the right State Admin identity
                        await pool.query(`
                            UPDATE affiliate_commission_log
                            SET affiliate_user_id = COALESCE(affiliate_user_id, $2),
                                affiliate_code = CASE
                                    WHEN affiliate_code IS NULL
                                      OR TRIM(affiliate_code) = ''
                                      OR UPPER(TRIM(affiliate_code)) = 'STATE'
                                    THEN $3
                                    ELSE affiliate_code
                                END
                            WHERE id = $1
                        `, [stateCheck.rows[0].id, stateAdmin.id, stateAdmin.refer_code || 'STATE']);

                        const currentStatus = stateCheck.rows[0]?.status;
                        if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
                            await pool.query(`
                                UPDATE affiliate_commission_log
                                SET status = 'CREDITED', credited_at = NOW()
                                WHERE id = $1
                            `, [stateCheck.rows[0].id]);
                        }
                    }
                }
            }

        } else if (asm) {
            // ... (ASM Logic remains the same) ...
            console.log(`[ASM Referral] ${asm.first_name} ${asm.last_name} (${asm.city}, ${asm.state})`);

            const affiliateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
            const branchRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
            const asmRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);

            const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '0');
            const branchBonus = parseFloat(branchRateResult.rows[0]?.commission_percentage || '0');
            const asmBonus = parseFloat(asmRateResult.rows[0]?.commission_percentage || '0');
            const totalRate = baseRate + branchBonus + asmBonus; // e.g. 70 + 15 + 10 = 95%
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
                    'asm_direct', commissionStatus,
                    payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                    payload.product_id, payload.category_id || null, payload.collection_id || null
                ]);
            } else {
                // UPDATE STATUS for ASM
                const currentStatus = existingCheck.rows[0]?.status;
                if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
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
                    const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '0');

                    const stateCommission = commissionAmount * (stateRate / 100);

                    // Check duplicate for State Admin
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
                                product_id, category_id, collection_id, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                        `, [
                            payload.order_id,
                            'STATE', // Placeholder code
                            payload.product_name || 'Product',
                            payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                            commissionPercentage, commissionAmount, stateRate, stateCommission,
                            'state_admin', commissionStatus,
                            payload.customer_id || null,
                            `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                            payload.product_id, payload.category_id || null, payload.collection_id || null
                        ]);
                        console.log(`[State Admin] Logged Commission: ₹${stateCommission} for ${stateAdmin.first_name} (ASM referral)`);
                    } else {
                        const currentStatus = stateCheck.rows[0]?.status;
                        if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
                            await pool.query(`
                                UPDATE affiliate_commission_log
                                SET status = 'CREDITED', credited_at = NOW()
                                WHERE id = $1
                            `, [stateCheck.rows[0].id]);
                        }
                    }
                }
            }

        } else {
            // STEP 3.6: Check State Admin Direct
            const stateAdminResult = await pool.query(`
                SELECT id, refer_code, first_name, last_name, email, state
                FROM state_admin
                WHERE LOWER(TRIM(refer_code)) = LOWER(TRIM($1))
            `, [payload.affiliate_code]);

            const stateAdmin = stateAdminResult.rows.length > 0 ? stateAdminResult.rows[0] : null;

            if (stateAdmin) {
                // State Admin Direct Referral - Gets 100% (70+15+10+5)
                console.log(`[State Admin Referral] ${stateAdmin.first_name} ${stateAdmin.last_name} (${stateAdmin.state})`);

                const affiliateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
                const branchRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
                const asmRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
                const stateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);

                const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '0');
                const branchBonus = parseFloat(branchRateResult.rows[0]?.commission_percentage || '0');
                const asmBonus = parseFloat(asmRateResult.rows[0]?.commission_percentage || '0');
                const stateBonus = parseFloat(stateRateResult.rows[0]?.commission_percentage || '0');

                const totalRate = baseRate + branchBonus + asmBonus + stateBonus; 
                const stateCommission = commissionAmount * (totalRate / 100);
                const canonicalStateReferCode = stateAdmin.refer_code;

                // Deduplication check
                const existingCheck = await pool.query(`
                    SELECT id, status FROM affiliate_commission_log 
                    WHERE order_id = $1
                      AND product_name = $2
                      AND commission_source = 'state_admin_direct'
                      AND LOWER(affiliate_code) = LOWER($3)
                `, [payload.order_id, payload.product_name, canonicalStateReferCode]);

                // UPDATE STATUS for State Admin Direct
                if (existingCheck.rows.length > 0) {
                    const currentStatus = existingCheck.rows[0]?.status;
                    if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
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
                        payload.order_id, canonicalStateReferCode, payload.product_name || 'Product',
                        payload.quantity || 1, payload.item_price || 0, payload.order_amount || 0,
                        commissionPercentage, commissionAmount, totalRate, stateCommission,
                        'state_admin_direct', commissionStatus,
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
                    SELECT id, branch, area, city, state, approved_by, entry_sponsor
                    FROM affiliate_user 
                    WHERE refer_code = $1
                `, [payload.affiliate_code]);

                const affiliateUser = affiliateUserRes.rows.length > 0 ? affiliateUserRes.rows[0] : null;

                // --- A) Pay Affiliate (70%) ---
                const rateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
                const affiliateRate = parseFloat(rateResult.rows[0]?.commission_percentage || '0');
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
                        'affiliate', commissionStatus,
                        payload.customer_id || null, payload.customer_name || null, payload.customer_email || null,
                        payload.product_id, payload.category_id || null, payload.collection_id || null
                    ]);


                    console.log(`[Affiliate] Logged Base Commission: ₹${affiliateCommission}`);


                    console.log(`[Affiliate] Logged Base Commission: ₹${affiliateCommission}`);
                } else {
                    // UPDATE STATUS
                    const currentStatus = existingCheck.rows[0]?.status;
                    if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
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
                    const branchAdmin = await resolveBranchAdminForSale(
                        pool,
                        affiliateUser.branch,
                        affiliateUser.approved_by,
                        affiliateUser.entry_sponsor,
                    );

                    if (branchAdmin) {
                        const brRateRes = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
                        const brRate = parseFloat(brRateRes.rows[0]?.commission_percentage || '0');
                        const brCommission = commissionAmount * (brRate / 100);

                        const brCheck = await pool.query(`
                            SELECT id, status FROM affiliate_commission_log 
                            WHERE order_id = $1 AND commission_source = 'branch_admin'
                              AND NULLIF(affiliate_user_id, '') = $2::text
                        `, [payload.order_id, branchAdmin.id]);

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
                                'branch_admin', commissionStatus,
                                payload.customer_id || null,
                                `${branchAdmin.first_name} ${branchAdmin.last_name}`, branchAdmin.email,
                                branchAdmin.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged Branch Override: ₹${brCommission}`);

                            if (shouldCreditCommission) {
                                await pool.query(`
                                    INSERT INTO customer_wallet (customer_id, coins_balance)
                                    SELECT id, $2 FROM branch_admin WHERE id = $1
                                    ON CONFLICT (customer_id)
                                    DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
                                `, [branchAdmin.id, brCommission]);
                            }

                            // NOTIFY Branch Admin (Override)
                            sendNotification(branchAdmin.refer_code, {
                                type: 'stats_update',
                                message: commissionStatus === "CREDITED"
                                    ? `Override Commission Credited: ₹${brCommission.toFixed(2)}`
                                    : `Override Commission Pending: ₹${brCommission.toFixed(2)}`,
                                amount: brCommission
                            });


                        } else {
                            // ... existing update logic
                            // UPDATE STATUS for Branch Admin
                            const currentStatus = brCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
                                await pool.query(`
                                    UPDATE affiliate_commission_log 
                                    SET status = 'CREDITED', credited_at = NOW()
                                    WHERE id = $1
                                `, [brCheck.rows[0].id]);

                                // ... existing wallet logic
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
                        const areaRate = parseFloat(areaRateRes.rows[0]?.commission_percentage || '0');
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
                                'area_manager', commissionStatus,
                                payload.customer_id || null,
                                `${asm.first_name} ${asm.last_name}`, asm.email,
                                asm.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged ASM Override: ₹${areaCommission}`);


                        } else {
                            // ... update logic ...
                            const currentStatus = areaCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
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
                        const stateRate = parseFloat(stateRateRes.rows[0]?.commission_percentage || '0');
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
                                'state_admin', commissionStatus,
                                payload.customer_id || null,
                                `${stateAdmin.first_name} ${stateAdmin.last_name}`, stateAdmin.email,
                                stateAdmin.id, // Set affiliate_user_id
                                payload.product_id, payload.category_id || null, payload.collection_id || null
                            ]);
                            console.log(`[Hierarchy] Logged State Override: ₹${stateCommission}`);


                        } else {
                            // ... update logic ...
                            const currentStatus = stateCheck.rows[0]?.status;
                            if (currentStatus !== 'CREDITED' && shouldCreditCommission) {
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

        try {
            await applyAdditionalCommissionForOrder(payload.order_id);
        } catch (additionalError) {
            console.error("[Additional Commission] Failed to apply additional commission:", additionalError);
        }

        return NextResponse.json({
            success: true,
            hierarchy_applied: !!branchAdmin,
            asm_referral: !!asm,
            message: "Commission processed successfully"
        });

    } catch (error: unknown) {
        console.error("Commission recording failed:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
