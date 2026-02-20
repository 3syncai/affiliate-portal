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

async function checkUser() {
    try {
        console.log('--- START DEBUG ---');
        // Check Affiliate User
        const au = await pool.query(`SELECT count(*) FROM affiliate_user WHERE refer_code = 'OWEGUPTESTING94602'`);
        console.log('Affiliate User Count:', au.rows[0].count);
        
        // Check State Admin
        const sa = await pool.query(`SELECT count(*) FROM state_admin WHERE refer_code = 'OWEGUPTESTING94602'`);
        console.log('State Admin Count:', sa.rows[0].count);
        
        console.log('--- END DEBUG ---');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkUser();
