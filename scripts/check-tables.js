const { Pool } = require('pg');

async function checkTables() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('=== Checking Database Tables ===\n');

        // List all tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('All tables in database:');
        tables.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.table_name}`);
        });

        // Look for commission-related tables
        console.log('\n=== Commission-related tables ===');
        const commissionTables = tables.rows.filter(r =>
            r.table_name.toLowerCase().includes('commission') ||
            r.table_name.toLowerCase().includes('affiliate')
        );
        commissionTables.forEach(row => {
            console.log(`  • ${row.table_name}`);
        });

        // Look for withdrawal-related tables
        console.log('\n=== Withdrawal-related tables ===');
        const withdrawalTables = tables.rows.filter(r =>
            r.table_name.toLowerCase().includes('withdrawal') ||
            r.table_name.toLowerCase().includes('payout')
        );
        withdrawalTables.forEach(row => {
            console.log(`  • ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTables().catch(console.error);
