const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('=== Running Activity Log Migrations ===\n');

        // Step 1: Create activity_log table
        console.log('Step 1: Creating activity_log table...');
        const createSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/create_activity_log.sql'),
            'utf-8'
        );
        await pool.query(createSQL);
        console.log('✅ activity_log table created\n');

        // Step 2: Enhance activity_log with new columns
        console.log('Step 2: Adding hierarchical columns...');
        const enhanceSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/enhance_activity_log.sql'),
            'utf-8'
        );
        await pool.query(enhanceSQL);
        console.log('✅ Added actor_area, product_name, product_id columns');
        console.log('✅ Added indexes for hierarchical queries\n');

        console.log('🎉 All migrations completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Restart your dev server');
        console.log('2. Create some test data (orders, commissions, withdrawals)');
        console.log('3. Check the activity feeds on each admin dashboard');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigrations().catch(console.error);
