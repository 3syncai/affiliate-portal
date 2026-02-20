/* eslint-disable @typescript-eslint/no-require-imports */  

const { Pool } = require('pg');

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
        console.log('\n=== Commission Log for Order ===');
        const acl = await pool.query("SELECT order_id, affiliate_code, product_name, commission_amount, status, created_at FROM affiliate_commission_log WHERE order_id = 'order_01KFRG2FBXT45S7SEDBPEEX3J7'");
        if (acl.rows.length === 0) {
            console.log('No commission log found for this order.');
        } else {
            console.table(acl.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
