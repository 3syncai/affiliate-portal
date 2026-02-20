/* eslint-disable @typescript-eslint/no-require-imports */  
const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
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
