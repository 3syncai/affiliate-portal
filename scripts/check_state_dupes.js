
const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('=== Checking State Admin Logs ===');
        const res = await pool.query(`
        SELECT id, order_id, commission_amount, affiliate_commission, commission_source, created_at, affiliate_code 
        FROM affiliate_commission_log 
        WHERE commission_source = 'state_admin'
    `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
