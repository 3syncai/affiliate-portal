const { Pool } = require('pg');

async function listAllTables() {
    const pool = new Pool({
        connectionString: 'postgres://postgres:Oweg4719@oweg-db4719.cdq0aquucpbq.ap-south-1.rds.amazonaws.com:5432/oweg_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n=== Listing All Tables in oweg_db ===\n');

        const query = `
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename
        `;

        const result = await pool.query(query);

        console.log(`Found ${result.rows.length} tables:\n`);

        let currentSchema = '';
        result.rows.forEach(row => {
            if (row.schemaname !== currentSchema) {
                currentSchema = row.schemaname;
                console.log(`\n[Schema: ${currentSchema}]`);
            }
            console.log(`  - ${row.tablename}`);
        });

        // Look for affiliate-related tables
        console.log('\n\n=== Affiliate-Related Tables ===');
        const affiliateTables = result.rows.filter(r =>
            r.tablename.toLowerCase().includes('affiliate') ||
            r.tablename.toLowerCase().includes('commission') ||
            r.tablename.toLowerCase().includes('withdrawal')
        );

        if (affiliateTables.length > 0) {
            affiliateTables.forEach(t => console.log(`  ${t.schemaname}.${t.tablename}`));
        } else {
            console.log('  ❌ No affiliate tables found!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

listAllTables().catch(console.error);
