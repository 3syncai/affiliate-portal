/* eslint-disable @typescript-eslint/no-require-imports */  

const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
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
