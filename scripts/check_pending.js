/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');

async function checkPending() {
    console.log('Checking for Pending Commissions...');
    const connectionString =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.PG_CONNECTION_STRING;

    if (!connectionString) {
        console.error('CRITICAL ERROR: Set DATABASE_URL (or POSTGRES_URL / PG_CONNECTION_STRING) before running this script.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
    });

    try {
        const res = await pool.query(`
            SELECT id, order_id, affiliate_code, affiliate_commission, status, created_at 
            FROM affiliate_commission_log 
            WHERE status = 'PENDING'
            ORDER BY created_at DESC
        `);

        if (res.rows.length === 0) {
            console.log('No PENDING commissions found.');
        } else {
            console.log(`Found ${res.rows.length} PENDING commissions:`);
            res.rows.forEach(row => {
                console.log(` - Commission ID: ${row.id} | Order: ${row.order_id} | User: ${row.affiliate_code} | Amt: ₹${row.affiliate_commission} | Date: ${row.created_at}`);
            });
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkPending();
