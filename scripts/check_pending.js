/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');

async function checkPending() {
    console.log('Checking for Pending Commissions...');
    const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

    if (!connectionString) {
        console.error('CRITICAL ERROR: DATABASE_URL environment variable is not set.');
        process.exit(1);
    }

    const pool = new Pool({
        // Hardcoding based on .env
        connectionString,
        ssl: connectionString.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
    });

    try {
        const res = await pool.query(`
            SELECT id, order_id, affiliate_code, affiliate_commission, status, created_at 
            FROM affiliate_commission_log 
            WHERE status = 'PENDING'
            ORDER BY created_at DESC
        `);

        if (res.rows.length === 0) {
            console.log('No PENDING commissions found.');
        } else {
            console.log(`Found ${res.rows.length} PENDING commissions:`);
            res.rows.forEach(row => {
                console.log(` - Commission ID: ${row.id} | Order: ${row.order_id} | User: ${row.affiliate_code} | Amt: ₹${row.affiliate_commission} | Date: ${row.created_at}`);
            });
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkPending();
