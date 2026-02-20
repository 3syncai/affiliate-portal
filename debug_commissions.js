/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
});

async function debug() {
    try {
        // 1. Find the Branch Admin
        console.log('Searching for Branch Admin "abhijeet"...');
        const userRes = await pool.query("SELECT * FROM branch_admin WHERE first_name ILIKE '%abhijeet%' OR email ILIKE '%abhijit%'");

        if (userRes.rows.length === 0) {
            console.log('User not found.');
            return;
        }

        const user = userRes.rows[0];
        console.log(`Found User: ${user.first_name} ${user.last_name} (ID: ${user.id}, Code: ${user.refer_code})`);

        // 2. Sum by User ID
        const sumByIdRes = await pool.query(`
      SELECT COUNT(*) as count, SUM(affiliate_commission) as total 
      FROM affiliate_commission_log 
      WHERE affiliate_user_id = $1 AND status = 'CREDITED'
    `, [user.id]);
        console.log(`\n[By User ID] Count: ${sumByIdRes.rows[0].count}, Total: ₹${sumByIdRes.rows[0].total}`);

        // 3. Sum by Refer Code
        const sumByCodeRes = await pool.query(`
      SELECT COUNT(*) as count, SUM(affiliate_commission) as total 
      FROM affiliate_commission_log 
      WHERE affiliate_code = $1 AND status = 'CREDITED'
    `, [user.refer_code]);
        console.log(`[By Refer Code] Count: ${sumByCodeRes.rows[0].count}, Total: ₹${sumByCodeRes.rows[0].total}`);

        // 4. Sum by Combined (My Fix Logic)
        const sumCombinedRes = await pool.query(`
      SELECT COUNT(*) as count, SUM(affiliate_commission) as total 
      FROM affiliate_commission_log 
      WHERE (affiliate_user_id = $1 OR affiliate_code = $2) AND status = 'CREDITED'
    `, [user.id, user.refer_code]);
        console.log(`[Combined (Fix)] Count: ${sumCombinedRes.rows[0].count}, Total: ₹${sumCombinedRes.rows[0].total}`);


        // 5. Breakdown by Source (Combined)
        const breakdownRes = await pool.query(`
      SELECT commission_source, COUNT(*) as count, SUM(affiliate_commission) as total 
      FROM affiliate_commission_log 
      WHERE (affiliate_user_id = $1 OR affiliate_code = $2) AND status = 'CREDITED'
      GROUP BY commission_source
    `, [user.id, user.refer_code]);

        console.log('\n[Breakdown by Source]');
        breakdownRes.rows.forEach(row => {
            console.log(` - ${row.commission_source}: ${row.count} orders, ₹${row.total}`);
        });

        // 6. Paid Amount Check
        const paidRes = await pool.query(`
        SELECT SUM(amount) as net_paid, SUM(gross_amount) as gross_paid, SUM(tds_amount) as tds_paid
        FROM admin_payments
        WHERE recipient_id = $1 AND recipient_type = 'branch' AND status = 'completed'
    `, [user.id]);
        const paid = paidRes.rows[0];
        console.log(`\n[Payments] Net: ₹${paid.net_paid}, TDS: ₹${paid.tds_paid}, Gross: ₹${paid.gross_paid}`);

        // Calculation
        const earned = parseFloat(sumCombinedRes.rows[0].total || 0);
        const grossPaid = parseFloat(paid.gross_paid || 0);
        const mixedPaid = grossPaid > 0 ? grossPaid : (parseFloat(paid.net_paid || 0) + parseFloat(paid.tds_paid || 0));

        console.log(`\n[Final Balance Calculation]`);
        console.log(`Earned (Corrected): ₹${earned}`);
        console.log(`Paid (Gross):      ₹${mixedPaid}`);
        console.log(`Balance:           ₹${(earned - mixedPaid).toFixed(2)}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debug();
