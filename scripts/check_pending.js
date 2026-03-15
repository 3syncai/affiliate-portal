const { Pool } = require('pg');

async function checkPending() {
    console.log('Checking for Pending Commissions...');
    const pool = new Pool({
        // Hardcoding based on .env
        connectionString: "postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify",
        ssl: { rejectUnauthorized: false }
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
