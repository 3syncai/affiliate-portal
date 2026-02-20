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
        console.log('=== Contents of affiliate_commission (UI Table) ===');
        const ac = await pool.query('SELECT * FROM affiliate_commission');
        console.table(ac.rows);

        console.log('\n=== Contents of product_commissions (Webhook Table) ===');
        const pc = await pool.query('SELECT * FROM product_commissions');
        console.table(pc.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
