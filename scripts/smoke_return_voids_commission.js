/* eslint-disable */
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
    'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

// Use a real affiliate refer_code so /api/affiliate/orders doesn't short-circuit
// with a 404 before invoking the sync.
const TEST_CODE = process.env.SMOKE_REFER_CODE || 'OWEGVISHAL65215';
const TEST_RR_ID = '__sim_return_req__';

async function cleanup() {
    // Only clean rows we created (cust_sim) so we don't nuke real commissions
    // that already belong to TEST_CODE.
    await pool.query(
        `DELETE FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND customer_id = 'cust_sim'`,
        [TEST_CODE]
    );
    await pool.query("DELETE FROM return_request WHERE id = $1", [TEST_RR_ID]);
}

async function main() {
    const orderRow = (await pool.query('SELECT id FROM "order" ORDER BY created_at DESC LIMIT 1')).rows[0];
    if (!orderRow) {
        console.log('No order found, skipping');
        return;
    }
    const orderId = orderRow.id;

    console.log('Using order_id =', orderId);
    await cleanup();

    await pool.query(
        `INSERT INTO affiliate_commission_log
            (order_id, affiliate_code, customer_id, status,
             commission_amount, affiliate_commission,
             unlock_at, additional_commission_amount, created_at)
         VALUES ($1, $2, 'cust_sim', 'PENDING', 100, 70,
                 NOW() + INTERVAL '4 minutes', 5, NOW())`,
        [orderId, TEST_CODE]
    );

    let r = await pool.query(
        `SELECT status, unlock_at, affiliate_commission, additional_commission_amount
         FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND customer_id = 'cust_sim'`,
        [TEST_CODE]
    );
    console.log('Before return:', r.rows[0]);

    await pool.query(
        `INSERT INTO return_request
            (id, order_id, customer_id, type, status, payment_type, refund_method,
             created_at, updated_at)
         VALUES ($1, $2, 'cust_sim', 'REFUND', 'pending_approval',
                 'PREPAID', 'wallet', NOW(), NOW())`,
        [TEST_RR_ID, orderId]
    );

    const res = await fetch('http://localhost:3001/api/affiliate/orders', {
        headers: { 'x-affiliate-code': TEST_CODE }
    });
    console.log('GET /api/affiliate/orders ->', res.status);

    r = await pool.query(
        `SELECT status, unlock_at, affiliate_commission, additional_commission_amount
         FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND customer_id = 'cust_sim'`,
        [TEST_CODE]
    );
    console.log('After sync (return active):', r.rows[0]);

    const data = await res.json().catch(() => null);
    const row = data && data.orders ? data.orders.find((o) => o.order_id === orderId) : null;
    if (row) {
        console.log('API row payload:', {
            status: row.status,
            unlock_at: row.unlock_at,
            commission_amount: row.commission_amount,
            has_return: row.has_return
        });
    }

    await cleanup();
    console.log('cleanup done');
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
