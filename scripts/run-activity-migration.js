const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('Running activity_log enhancement migration...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/enhance_activity_log.sql'),
            'utf-8'
        );

        await pool.query(migrationSQL);

        console.log('✅ Migration completed successfully!');
        console.log('Added columns: actor_area, product_name, product_id');
        console.log('Added indexes for better query performance');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
