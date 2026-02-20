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

async function getProduct() {
    try {
        const res = await pool.query(`SELECT id, title FROM product LIMIT 1`);
        console.log('Product:', res.rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

getProduct();
