/* eslint-disable @typescript-eslint/no-require-imports */  
const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
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
