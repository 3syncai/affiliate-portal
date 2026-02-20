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

async function checkCommissions() {
    try {
        console.log('Checking recent commission logs...');
        const res = await pool.query(`
            SELECT * FROM affiliate_commission_log 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(res.rows);

        console.log('\nChecking logs for test emails...');
        const res2 = await pool.query(`
            SELECT * FROM affiliate_commission_log 
            WHERE customer_email IN ('test98@gmail.com', 'test99@gmail.com')
        `);
        console.table(res2.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkCommissions();
