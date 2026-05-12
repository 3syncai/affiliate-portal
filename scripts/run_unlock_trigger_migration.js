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
    const sqlPath = path.join(__dirname, '..', 'migrations', 'add_commission_unlock_trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration: add_commission_unlock_trigger.sql');
    try {
        await pool.query(sql);
        const triggerCheck = await pool.query(`
            SELECT tgname, tgenabled
            FROM pg_trigger
            WHERE tgname = 'enforce_commission_unlock_delay_trigger'
        `);
        if (triggerCheck.rows.length > 0) {
            console.log('OK: trigger installed ->', triggerCheck.rows[0]);
        } else {
            console.error('FAIL: trigger missing after migration');
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
