const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL ||
    'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const sqlPath = path.join(__dirname, '..', 'migrations', 'add_commission_unlock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration: add_commission_unlock.sql');
    try {
        await pool.query(sql);
        const colCheck = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'affiliate_commission_log'
              AND column_name = 'unlock_at'
        `);
        if (colCheck.rows.length > 0) {
            console.log('OK: unlock_at column exists ->', colCheck.rows[0]);
        } else {
            console.error('FAIL: unlock_at column missing after migration');
            process.exit(1);
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
