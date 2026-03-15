
const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
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
