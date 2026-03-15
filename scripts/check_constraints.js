const { Pool } = require('pg');

const connectionString = 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
    try {
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'affiliate_commission_log'::regclass
        `);
        res.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkConstraints();
