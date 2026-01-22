const { Pool } = require('pg');

async function checkCitySpelling() {
    const pool = new Pool({
        connectionString: 'postgres://postgres:Oweg4719@oweg-db4719.cdq0aquucpbq.ap-south-1.rds.amazonaws.com:5432/oweg_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n=== Checking City Names ===\n');

        // 1. Get all unique cities
        const citiesQuery = `SELECT DISTINCT city FROM affiliate_user WHERE city IS NOT NULL ORDER BY city`;
        const cities = await pool.query(citiesQuery);
        console.log('All cities in database:');
        cities.rows.forEach(r => console.log(`  - "${r.city}"`));

        // 2. Check commissions for each city variant
        console.log('\n\nChecking commission counts by city:');
        const variants = ['Palghar', 'Paighar', 'Palighar'];

        for (const city of variants) {
            const query = `
                SELECT COUNT(*) as count
                FROM affiliate_commission_log acl
                JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
                WHERE u.city ILIKE $1
            `;
            const result = await pool.query(query, [city]);
            console.log(`  ${city}: ${result.rows[0].count} commissions`);
        }

        // 3. Show sample commission with exact city name
        console.log('\n\nSample commission with exact city:');
        const sampleQuery = `
            SELECT 
                u.city,
                u.branch,
                acl.product_name,
                acl.created_at
            FROM affiliate_commission_log acl
            JOIN affiliate_user u ON acl.affiliate_code = u.refer_code
            LIMIT 1
        `;
        const sample = await pool.query(sampleQuery);
        if (sample.rows.length > 0) {
            console.log('  Exact city name:', `"${sample.rows[0].city}"`);
            console.log('  Branch:', sample.rows[0].branch);
            console.log('  Product:', sample.rows[0].product_name);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkCitySpelling().catch(console.error);
