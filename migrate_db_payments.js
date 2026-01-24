const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('Adding tds_amount column...');
        await pool.query('ALTER TABLE admin_payments ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12, 2) DEFAULT 0');

        console.log('Adding gross_amount column...');
        await pool.query('ALTER TABLE admin_payments ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12, 2) DEFAULT 0');

        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
