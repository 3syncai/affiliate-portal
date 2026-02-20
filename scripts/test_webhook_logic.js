/* eslint-disable @typescript-eslint/no-require-imports */  
const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

async function testWebhook() {
    const payload = {
        order_id: "ORDER_TEST_DEBUG_005",
        affiliate_code: "OWEGUPTESTING94602",
        product_id: "prod_01JJKZ4Q80K41270M4M1JQT02V",
        product_name: "Vintage Test",
        quantity: 1,
        item_price: 1000,
        order_amount: 1000,
        status: "PENDING",
        customer_email: "test_debug@gmail.com",
        customer_id: "cus_dummy_123"
    };

    try {
        console.log('Testing webhook logic for:', payload.affiliate_code);

        // 1. Commission Lookup
        // Mocking 0% fallback for simplicity if not found
        let commissionPercentage = 0;
        
        // 2. State Admin Check
        const stateAdminResult = await pool.query(`
            SELECT *
            FROM state_admin
            WHERE TRIM(refer_code) = TRIM($1)
        `, [payload.affiliate_code]);

        console.log('Query param (JSON):', JSON.stringify(payload.affiliate_code));
        console.log('Row count:', stateAdminResult.rows.length);

        const stateAdmin = stateAdminResult.rows.length > 0 ? stateAdminResult.rows[0] : null;

        if (stateAdmin) {
            console.log(`Found State Admin: ${stateAdmin.first_name} (${stateAdmin.state})`);

            // Fetch Rates
            const affiliateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
            const branchRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'branch'`);
            const asmRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'area'`);
            const stateRateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'state'`);

            const baseRate = parseFloat(affiliateRateResult.rows[0]?.commission_percentage || '70');
            const branchBonus = parseFloat(branchRateResult.rows[0]?.commission_percentage || '15');
            const asmBonus = parseFloat(asmRateResult.rows[0]?.commission_percentage || '10');
            const stateBonus = parseFloat(stateRateResult.rows[0]?.commission_percentage || '5');

            const totalRate = baseRate + branchBonus + asmBonus + stateBonus;
            console.log(`Total Rate: ${totalRate}%`);

            const commissionAmount = payload.order_amount * (commissionPercentage / 100); // 0
            // Note: In the real code commissionAmount is heavily dependent on the product commission
            // But here the "affiliate_commission" calculation uses commissionAmount * (totalRate / 100)
            // Wait, looking at the code:
            // const stateCommission = commissionAmount * (totalRate / 100);
            
            // IF commissionPercentage is 0, then commissionAmount is 0, so stateCommission is 0.
            // THIS MIGHT BE THE ISSUE.
            // If the product has no commission rate set in `affiliate_commission` table, it defaults to 0%.
            // Then 0 * anything = 0.
            
            const stateCommission = commissionAmount * (totalRate / 100);
            console.log(`Calculated Commission: ${stateCommission}`);

            // Insert
             await pool.query(`
                INSERT INTO affiliate_commission_log (
                    order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                    commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                    commission_source, status, customer_id, customer_name, customer_email, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            `, [
                payload.order_id, payload.affiliate_code, payload.product_name,
                payload.quantity, payload.item_price, payload.order_amount,
                commissionPercentage, commissionAmount, totalRate, stateCommission,
                'state_admin_direct', payload.status,
                null, 'Test User', payload.customer_email
            ]);
            console.log('Inserted successfully.');

        } else {
            console.log('Not a State Admin. Falling back to Regular Affiliate.');

            // --- Regular Affiliate Logic ---
            const rateResult = await pool.query(`SELECT commission_percentage FROM commission_rates WHERE role_type = 'affiliate'`);
            const affiliateRate = parseFloat(rateResult.rows[0]?.commission_percentage || '70');
            console.log(`Affiliate Rate: ${affiliateRate}%`);

            const commissionAmount = payload.order_amount * (commissionPercentage / 100); // 0 if fallback
            const affiliateCommission = 0.01; // Force distinct value
            console.log(`Affiliate Commission: ${affiliateCommission}`);

            // Fetch User ID
            const userRes = await pool.query(`SELECT id FROM affiliate_user WHERE refer_code = $1`, [payload.affiliate_code]);
            const userId = userRes.rows[0]?.id;

            try {
                await pool.query(`
                    INSERT INTO affiliate_commission_log (
                        order_id, affiliate_code, affiliate_user_id, product_name, quantity, item_price, order_amount,
                        commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                        commission_source, status, customer_id, customer_name, customer_email, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
                `, [
                    payload.order_id, payload.affiliate_code, userId, payload.product_name,
                    payload.quantity, payload.item_price, payload.order_amount,
                    commissionPercentage, commissionAmount, affiliateRate, affiliateCommission,
                    'affiliate', payload.status,
                    payload.customer_id, 'Test User Regular', payload.customer_email
                ]);
                console.log('Inserted Regular Affiliate commission successfully.');
            } catch (insertErr) {
                console.error('Insertion Failed:', insertErr);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

testWebhook();
