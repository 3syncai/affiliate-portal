/* eslint-disable */
/**
 * Smoke test: 7-day post-delivery commission hold (use COMMISSION_UNLOCK_MINUTES=1 on dev server).
 *
 * Usage:
 *   COMMISSION_UNLOCK_MINUTES=1 node scripts/smoke_commission_unlock_window.js
 *
 * Requires dev server at SMOKE_BASE_URL (default http://localhost:3001).
 */
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
    'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

const TEST_CODE = process.env.SMOKE_REFER_CODE || 'OWEGVISHAL65215';
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3001';
const TEST_RR_PENDING = '__sim_rr_pending__';
const TEST_RR_APPROVED = '__sim_rr_approved__';
const CUSTOMER_ID = 'cust_unlock_smoke';

function assert(condition, message) {
    if (!condition) {
        throw new Error(`ASSERT FAILED: ${message}`);
    }
    console.log('  OK:', message);
}

async function triggerSync() {
    const res = await fetch(`${BASE_URL}/api/affiliate/orders`, {
        headers: { 'x-affiliate-code': TEST_CODE }
    });
    if (!res.ok) {
        throw new Error(`Sync trigger failed: GET /api/affiliate/orders -> ${res.status}`);
    }
    return res.json();
}

async function getSimRow(orderId) {
    const r = await pool.query(
        `SELECT status, unlock_at, affiliate_commission, credited_at
         FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND customer_id = $2 AND order_id = $3`,
        [TEST_CODE, CUSTOMER_ID, orderId]
    );
    return r.rows[0] || null;
}

async function cleanup(orderId) {
    await pool.query(
        `DELETE FROM affiliate_commission_log
         WHERE affiliate_code = $1 AND customer_id = $2`,
        [TEST_CODE, CUSTOMER_ID]
    );
    await pool.query(
        `DELETE FROM return_request WHERE id IN ($1, $2)`,
        [TEST_RR_PENDING, TEST_RR_APPROVED]
    );
    if (orderId) {
        await pool.query(
            `UPDATE "order"
             SET fulfillment_status = NULL,
                 metadata = COALESCE(metadata, '{}'::jsonb) - 'shiprocket_delivered_at' - 'shiprocket_status'
             WHERE id = $1`,
            [orderId]
        ).catch(() => null);
    }
}

async function main() {
    const orderRow = (await pool.query('SELECT id FROM "order" ORDER BY created_at DESC LIMIT 1')).rows[0];
    if (!orderRow) {
        console.log('No order found, skipping');
        return;
    }
    const orderId = orderRow.id;
    console.log('Using order_id =', orderId);
    await cleanup(orderId);

    // Case 1: not delivered -> PENDING, no unlock_at
    await pool.query(
        `INSERT INTO affiliate_commission_log
            (order_id, affiliate_code, customer_id, status,
             commission_amount, affiliate_commission, created_at)
         VALUES ($1, $2, $3, 'PENDING', 100, 70, NOW())`,
        [orderId, TEST_CODE, CUSTOMER_ID]
    );
    await triggerSync();
    let row = await getSimRow(orderId);
    console.log('\nCase 1 — not delivered:', row);
    assert(row?.status === 'PENDING', 'status is PENDING before delivery');
    assert(!row?.unlock_at, 'unlock_at is null before delivery');

    // Case 2: mark delivered -> unlock_at set, still PENDING
    await pool.query(
        `UPDATE "order"
         SET fulfillment_status = 'delivered',
             metadata = COALESCE(metadata, '{}'::jsonb) ||
                 jsonb_build_object('shiprocket_delivered_at', NOW()::text)
         WHERE id = $1`,
        [orderId]
    );
    await triggerSync();
    row = await getSimRow(orderId);
    console.log('\nCase 2 — delivered:', row);
    assert(row?.status === 'PENDING', 'status stays PENDING after delivery');
    assert(!!row?.unlock_at, 'unlock_at is set after delivery');
    assert(!row?.credited_at, 'credited_at remains null during hold');

    // Case 3: pending return request blocks promotion
    await pool.query(
        `INSERT INTO return_request
            (id, order_id, customer_id, type, status, payment_type, refund_method,
             created_at, updated_at)
         VALUES ($1, $2, $3, 'REFUND', 'pending_approval',
                 'PREPAID', 'wallet', NOW(), NOW())`,
        [TEST_RR_PENDING, orderId, CUSTOMER_ID]
    );
    await pool.query(
        `UPDATE affiliate_commission_log
         SET unlock_at = NOW() - INTERVAL '1 minute'
         WHERE affiliate_code = $1 AND customer_id = $2 AND order_id = $3`,
        [TEST_CODE, CUSTOMER_ID, orderId]
    );
    await triggerSync();
    row = await getSimRow(orderId);
    console.log('\nCase 3 — pending return (unlock elapsed):', row);
    assert(row?.status === 'PENDING', 'pending return blocks CREDITED promotion');

    const apiData = await triggerSync();
    const apiRow = apiData.orders?.find((o) => o.order_id === orderId);
    if (apiRow) {
        console.log('  API flags:', {
            has_return: apiRow.has_return,
            has_return_request: apiRow.has_return_request,
            status: apiRow.status
        });
        assert(apiRow.has_return_request === true, 'API exposes has_return_request');
        assert(apiRow.has_return === false, 'API has_return false for pending approval');
    }

    await pool.query('DELETE FROM return_request WHERE id = $1', [TEST_RR_PENDING]);

    // Case 4: after unlock with no blockers -> CREDITED
    await pool.query(
        `UPDATE affiliate_commission_log
         SET unlock_at = NOW() - INTERVAL '1 minute', status = 'PENDING', credited_at = NULL
         WHERE affiliate_code = $1 AND customer_id = $2 AND order_id = $3`,
        [TEST_CODE, CUSTOMER_ID, orderId]
    );
    await triggerSync();
    row = await getSimRow(orderId);
    console.log('\nCase 4 — unlock elapsed, no blockers:', row);
    assert(row?.status === 'CREDITED', 'promoted to CREDITED after unlock window');
    assert(!!row?.credited_at, 'credited_at set on promotion');

    // Case 5: approved return voids commission (fresh row)
    await cleanup(orderId);
    await pool.query(
        `INSERT INTO affiliate_commission_log
            (order_id, affiliate_code, customer_id, status,
             commission_amount, affiliate_commission, unlock_at, created_at)
         VALUES ($1, $2, $3, 'PENDING', 100, 70, NOW() + INTERVAL '1 day', NOW())`,
        [orderId, TEST_CODE, CUSTOMER_ID]
    );
    await pool.query(
        `INSERT INTO return_request
            (id, order_id, customer_id, type, status, payment_type, refund_method,
             created_at, updated_at)
         VALUES ($1, $2, $3, 'REFUND', 'approved',
                 'PREPAID', 'wallet', NOW(), NOW())`,
        [TEST_RR_APPROVED, orderId, CUSTOMER_ID]
    );
    await triggerSync();
    row = await getSimRow(orderId);
    console.log('\nCase 5 — approved return:', row);
    assert(row?.status === 'CANCELLED', 'approved return voids commission');
    assert(Number(row?.affiliate_commission) === 0, 'commission amount zeroed');

    await cleanup(orderId);
    console.log('\nAll smoke checks passed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
