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

async function debugDirectReferrals() {
    try {
        console.log('--- Debugging Direct Referrals ---');

        // 1. Get State Admins
        const admins = await pool.query('SELECT id, first_name, refer_code FROM state_admin LIMIT 5');
        console.log('State Admins found:', admins.rows);

        if (admins.rows.length === 0) {
            console.log('No State Admins found.');
            return;
        }

        const referCode = admins.rows[0].refer_code;
        console.log(`\nChecking commissions for Refer Code: ${referCode}`);

        // 2. Query commissions like the API does
        const query = `
            SELECT 
                id, order_id, affiliate_code, commission_amount, affiliate_commission, status, created_at
            FROM affiliate_commission_log 
            WHERE affiliate_code = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [referCode]);
        console.log(`Found ${result.rows.length} commissions:`);

        result.rows.forEach(row => {
            console.log(` - ID: ${row.id}, Order: ${row.order_id}, Status: ${row.status}, Amt: ${row.affiliate_commission}`);
        });

        // 3. Check for any PENDING commissions in the WHOLE table
        const allPending = await pool.query(`
            SELECT id, order_id, affiliate_code, affiliate_commission, status, created_at
            FROM affiliate_commission_log 
            WHERE status = 'PENDING'
            ORDER BY created_at DESC
        `);
        console.log(`\nTotal PENDING commissions in DB: ${allPending.rows.length}`);
        allPending.rows.forEach(row => {
            console.log(` - PENDING: ID ${row.id}, Code: ${row.affiliate_code}, Order: ${row.order_id}, Amt: ${row.affiliate_commission}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugDirectReferrals();
