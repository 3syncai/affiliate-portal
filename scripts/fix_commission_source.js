
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify",
    ssl: { rejectUnauthorized: false }
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
