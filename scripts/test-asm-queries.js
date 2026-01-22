const { Pool } = require('pg');

async function testASMQueries() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    const area = "Palghar"; // or try "Palighar"

    try {
        console.log(`\n=== Testing ASM Activity Queries for area: ${area} ===\n`);

        // Test 1: Check if commission table exists and has data
        console.log('1. Testing commission query...');
        const commissionQuery = `
            SELECT 
                acl.id,
                acl.product_name,
                u.first_name,
                u.last_name,
                u.branch,
                u.city
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            WHERE u.city ILIKE $1
            LIMIT 5
        `;

        try {
            const result = await pool.query(commissionQuery, [area]);
            console.log(`   ✅ Found ${result.rows.length} commissions`);
            if (result.rows.length > 0) {
                console.log('   Sample:', result.rows[0]);
            }
        } catch (e) {
            console.log('   ❌ Commission query failed:', e.message);
        }

        // Test 2: Check all cities in database
        console.log('\n2. Checking all cities in database...');
        const citiesQuery = `SELECT DISTINCT city FROM affiliate_user WHERE city IS NOT NULL`;
        const cities = await pool.query(citiesQuery);
        console.log('   All cities:', cities.rows.map(r => r.city).join(', '));

        // Test 3: Check withdrawals
        console.log('\n3. Testing withdrawal query...');
        const withdrawalQuery = `
            SELECT COUNT(*) as count
            FROM withdrawal_request wr
            JOIN affiliate_user u ON wr.affiliate_id = u.id
            WHERE u.city ILIKE $1
        `;

        try {
            const result = await pool.query(withdrawalQuery, [area]);
            console.log(`   ✅ Found ${result.rows[0].count} withdrawals`);
        } catch (e) {
            console.log('   ❌ Withdrawal query failed:', e.message);
        }

        // Test 4: Check affiliate approvals
        console.log('\n4. Testing affiliate approvals...');
        const approvalQuery = `
            SELECT COUNT(*) as count
            FROM affiliate_user u
            WHERE u.city ILIKE $1
            AND u.is_approved = true
            AND u.is_agent = true
        `;

        const result = await pool.query(approvalQuery, [area]);
        console.log(`   ✅ Found ${result.rows[0].count} approved affiliates`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

testASMQueries().catch(console.error);
