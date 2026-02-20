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

async function fixCommissionSource() {
    console.log('--- Fixing Commission Source for State Admin Test Data ---');

    try {
        const stateAdminCode = 'STATEf60803'; // Krishnachandra

        // Update commission_source for records belonging to the state admin
        // that were previously just 'affiliate' or 'branch_admin' 
        // effectively migrating them to be "Direct" state admin sales
        const res = await pool.query(`
            UPDATE affiliate_commission_log
            SET commission_source = 'state_admin_direct'
            WHERE affiliate_code = $1 
              AND commission_source != 'state_admin_direct'
            RETURNING id, commission_source
        `, [stateAdminCode]);

        console.log(`Updated ${res.rowCount} records to 'state_admin_direct'.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixCommissionSource();
