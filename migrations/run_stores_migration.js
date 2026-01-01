const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, 'create_stores_table.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration: create_stores_table.sql');
        await pool.query(sql);
        console.log('✅ Migration completed successfully!');

        // Check if table was created
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'stores'
            );
        `);

        console.log('Stores table exists:', result.rows[0].exists);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
