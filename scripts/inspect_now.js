const { Pool } = require('pg');
const p = new Pool({
    connectionString: 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db',
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('--- Most recent 5 return_request rows (ALL) ---');
        let r = await p.query(`SELECT id, order_id, customer_id, status, created_at, deleted_at FROM return_request ORDER BY created_at DESC LIMIT 5`);
        console.log(r.rows);

        console.log('\n--- Order in "order" table (using LIKE to be safe) ---');
        r = await p.query(`SELECT id, status, canceled_at FROM "order" WHERE id ILIKE '%KR9MYAEH%'`);
        console.log(r.rows);

        console.log('\n--- Latest 5 orders sorted by created_at ---');
        r = await p.query(`SELECT id, status, created_at FROM "order" ORDER BY created_at DESC LIMIT 5`);
        console.log(r.rows);

        console.log('\n--- Distinct schemas containing "order" table ---');
        r = await p.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name='order'`);
        console.log(r.rows);

        console.log('\n--- Check current_database / current_user ---');
        r = await p.query(`SELECT current_database() as db, current_user as usr`);
        console.log(r.rows);
    } catch (e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        await p.end();
    }
})();
