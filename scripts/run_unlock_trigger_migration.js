const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL ||
    'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db';

const migrationFile =
    process.env.UNLOCK_TRIGGER_MIGRATION || 'update_commission_unlock_trigger_7d.sql';

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const sqlPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running migration: ${migrationFile}`);
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

        const fnCheck = await pool.query(`
            SELECT pg_get_functiondef(p.oid) AS def
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE p.proname = 'enforce_commission_unlock_delay'
              AND n.nspname = 'public'
            LIMIT 1
        `);
        const def = fnCheck.rows[0]?.def || '';
        if (def.includes("INTERVAL '7 days'")) {
            console.log('OK: trigger function uses 7-day interval');
        } else {
            console.warn('WARN: trigger function may not use 7-day interval; review migration output');
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
