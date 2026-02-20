/* eslint-disable @typescript-eslint/no-require-imports */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString.replace('?sslmode=no-verify', ''),
    ssl: connectionString.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        // 1. Check Product Category Link
        console.log('Checking category for product: prod_01KFR9PGZZT6CKDHEFFVZVTET5');
        const catLink = await pool.query(`
        SELECT pcp.product_category_id, pc.name 
        FROM product_category_product pcp
        JOIN product_category pc ON pc.id = pcp.product_category_id
        WHERE pcp.product_id = 'prod_01KFR9PGZZT6CKDHEFFVZVTET5'
    `);
        console.table(catLink.rows);

        if (catLink.rows.length > 0) {
            const catId = catLink.rows[0].product_category_id;
            // 2. Check Commission for this Category
            console.log(`Checking commission for category: ${catId}`);
            const catComm = await pool.query(`
            SELECT * FROM product_commissions WHERE category_id = $1
        `, [catId]);
            console.table(catComm.rows);
        }

        // 3. Remove the hardcoded product commission I added
        console.log('Removing hardcoded product commission (10%)...');
        await pool.query(`
        DELETE FROM product_commissions 
        WHERE product_id = 'prod_01KFR9PGZZT6CKDHEFFVZVTET5' AND commission_percentage = 10.00
    `);
        console.log('Removed.');

        // 4. Update the Order Log to 20% (Manually fixing the past order)
        console.log('Updating order log to 20%...');
        const orderAmount = 345;
        const newRate = 20.00;
        const newCommAmount = orderAmount * (newRate / 100); // 69.00
        const affiliateRate = 70; // 70% of 69 = 48.30
        const newAffComm = newCommAmount * (affiliateRate / 100);

        const updateRes = await pool.query(`
        UPDATE affiliate_commission_log
        SET commission_rate = $1, commission_amount = $2, affiliate_commission = $3
        WHERE order_id = 'order_01KFRG2FBXT45S7SEDBPEEX3J7'
        RETURNING *
    `, [newRate, newCommAmount, newAffComm]);

        console.log('Updated Log:', updateRes.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
