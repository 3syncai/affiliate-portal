/* eslint-disable @typescript-eslint/no-require-imports */  

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify",
    ssl: { rejectUnauthorized: false }
});

async function assignToStateAdmin() {
    console.log('--- Assigning Test Data to State Admin (STATE211111) ---');

    try {
        const stateAdminCode = 'STATE211111';
        const targetEmail = 'vvv@gmail.com';
        const targetAffiliateCode = 'OWEGVISHAL94014'; // The code that currently owns the commissions

        // 1. Update Customer Metadata
        console.log(`Updating customer ${targetEmail} metadata...`);
        const updateCust = await pool.query(`
            UPDATE customer 
            SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{referral_code}', '"${stateAdminCode}"')
            WHERE email = $1
            RETURNING id
        `, [targetEmail]);
        console.log(`Updated ${updateCust.rowCount} customer(s).`);

        // 2. Reassign Commissions (Only for recent PENDING ones)
        console.log(`Reassigning PENDING commissions from ${targetAffiliateCode} to ${stateAdminCode}...`);
        const updateComm = await pool.query(`
            UPDATE affiliate_commission_log
            SET affiliate_code = $1
            WHERE affiliate_code = $2 AND status = 'PENDING'
            RETURNING id
        `, [stateAdminCode, targetAffiliateCode]);
        console.log(`Reassigned ${updateComm.rowCount} commission(s).`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

assignToStateAdmin();
