const { Pool } = require('pg');

async function fixPending() {
    console.log('Fixing Pending Commissions (Starting from 2026-01-01)...');
    const pool = new Pool({
        connectionString: "postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db?sslmode=no-verify",
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Get Pending Commissions
        const res = await pool.query(`
            SELECT id, order_id, affiliate_code, affiliate_commission, status 
            FROM affiliate_commission_log 
            WHERE status = 'PENDING' 
              AND created_at >= '2026-01-01'
              AND affiliate_commission IS NOT NULL
        `);

        if (res.rows.length === 0) {
            console.log('No recent PENDING commissions to fix (with valid amounts).');
            return;
        }

        console.log(`Found ${res.rows.length} commissions to fix.`);

        // 2. Loop and Update
        for (const row of res.rows) {
            console.log(`Processing Order ${row.order_id} for User ${row.affiliate_code} (₹${row.affiliate_commission})...`);

            // A. Update Status (Removed updated_at)
            await pool.query(`
                UPDATE affiliate_commission_log 
                SET status = 'CREDITED'
                WHERE id = $1
            `, [row.id]);

            // B. Credit Wallet
            await pool.query(`
                INSERT INTO customer_wallet (customer_id, coins_balance)
                SELECT id, $2 FROM affiliate_user WHERE refer_code = $1
                ON CONFLICT (customer_id) 
                DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `, [row.affiliate_code, row.affiliate_commission]);

            console.log(` - Success: Credited ₹${row.affiliate_commission}`);
        }

        console.log('Done! All pending commissions fixed.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixPending();
