const { Pool } = require('pg');

async function checkDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: false
    });

    try {
        console.log('=== Checking Database ===\n');

        // 1. Check if migration columns exist
        console.log('1. Checking migration status...');
        const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'activity_log' 
        AND column_name IN ('actor_area', 'product_name', 'product_id')
    `);
        console.log('   Migration columns found:', columns.rows.map(r => r.column_name).join(', ') || 'NONE');

        if (columns.rows.length === 0) {
            console.log('   ⚠️  MIGRATION NOT RUN! Please visit: http://localhost:3000/api/admin/migrate-activity-log\n');
        } else {
            console.log('   ✅ Migration completed\n');
        }

        // 2. Check total activity count
        console.log('2. Checking activity_log table...');
        const count = await pool.query('SELECT COUNT(*) FROM activity_log');
        console.log('   Total activities:', count.rows[0].count);

        if (parseInt(count.rows[0].count) === 0) {
            console.log('   ⚠️  NO ACTIVITIES LOGGED YET!\n');
        }

        // 3. Show recent activities
        if (parseInt(count.rows[0].count) > 0) {
            console.log('\n3. Recent activities:');
            const recent = await pool.query(`
        SELECT 
          id, 
          activity_type, 
          actor_branch, 
          actor_area, 
          actor_state, 
          description,
          created_at 
        FROM activity_log 
        ORDER BY created_at DESC 
        LIMIT 5
      `);

            recent.rows.forEach((row, i) => {
                console.log(`\n   ${i + 1}. ${row.activity_type}`);
                console.log(`      Branch: ${row.actor_branch || 'NULL'}`);
                console.log(`      Area: ${row.actor_area || 'NULL'}`);
                console.log(`      State: ${row.actor_state || 'NULL'}`);
                console.log(`      Description: ${row.description || 'NULL'}`);
                console.log(`      Time: ${row.created_at}`);
            });
        }

    } catch (e) {
        console.error('\n❌ Error:', e.message);
        console.error('   Stack:', e.stack);
    } finally {
        await pool.end();
    }
}

checkDatabase().catch(console.error);
