/* eslint-disable @typescript-eslint/no-require-imports */

const { Pool } = require('pg');
const https = require('http'); // sending to localhost

const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PG_CONNECTION_STRING;

if (!connectionString) {
    console.error('CRITICAL ERROR: Set DATABASE_URL (or POSTGRES_URL / PG_CONNECTION_STRING) before running this script.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: connectionString.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        // 1. Insert Commission
        console.log('Inserting commission for testingvendorp2...');
        const checkRes = await pool.query('SELECT id FROM product_commissions WHERE product_id = $1', ['prod_01KFR9PGZZT6CKDHEFFVZVTET5']);

        let insertRes;
        if (checkRes.rows.length === 0) {
            insertRes = await pool.query(`
        INSERT INTO product_commissions (id, product_id, commission_percentage, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
    `, [
                crypto.randomUUID(),
                'prod_01KFR9PGZZT6CKDHEFFVZVTET5', // testingvendorp2
                10.00
            ]);
            console.log('Commission set (Inserted):', insertRes.rows[0]);
        } else {
            console.log('Commission already exists for this product.');
        }

        // 2. Backfill Order Log (Direct DB Insert)
        const orderId = "order_01KFRG2FBXT45S7SEDBPEEX3J7";
        const affiliateCode = "OWEGTESTING1AGENT71763";
        const orderAmount = 345;
        const commissionPercentage = 10.00;
        const commissionAmount = orderAmount * (commissionPercentage / 100);
        const affiliateRate = 70; // Assuming base affiliate
        const affiliateCommission = commissionAmount * (affiliateRate / 100);

        const logCheck = await pool.query('SELECT id FROM affiliate_commission_log WHERE order_id = $1', [orderId]);

        if (logCheck.rows.length === 0) {
            console.log('Backfilling order into commission log...');
            const logRes = await pool.query(`
            INSERT INTO affiliate_commission_log (
                order_id, affiliate_code, product_name, quantity, item_price, order_amount,
                commission_rate, commission_amount, affiliate_rate, affiliate_commission,
                commission_source, status, customer_id, customer_name, customer_email, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            RETURNING id
        `, [
                orderId,
                affiliateCode,
                "testingvendorp2",
                1,
                orderAmount,
                orderAmount,
                commissionPercentage,
                commissionAmount,
                affiliateRate,
                affiliateCommission,
                'affiliate',
                'PENDING',
                'cus_manual_fix',
                'testinguser L1',
                'testinguser@example.com'
            ]);
            console.log('Order backfilled. Log ID:', logRes.rows[0].id);
        } else {
            console.log('Order already logged.');
        }

        // 3. Trigger Webhook
        const payload = JSON.stringify({
            order_id: "order_01KFRG2FBXT45S7SEDBPEEX3J7",
            affiliate_code: "OWEGTESTING1AGENT71763",
            product_id: "prod_01KFR9PGZZT6CKDHEFFVZVTET5",
            product_name: "testingvendorp2",
            quantity: 1,
            item_price: 345,
            order_amount: 345,
            status: "PENDING", // Start as PENDING
            customer_id: "cus_temp_fix", // Placeholder if we don't have it
            customer_name: "testinguser L1",
            customer_email: "testinguser@example.com" // Placeholder
        });

        console.log('Triggering webhook with payload:', payload);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/webhook/commission',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            }
        };

        const req = https.request(options, (res) => {
            console.log(`Webhook Status: ${res.statusCode}`);
            res.on('data', (d) => {
                process.stdout.write(d);
            });
        });

        req.on('error', (error) => {
            console.error(error);
        });

        req.write(payload);
        req.end();

    } catch (err) {
        console.error(err);
    } finally {
        // Wait a bit for webhook request to complete
        setTimeout(() => pool.end(), 2000);
    }
}

run();
