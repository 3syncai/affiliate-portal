const { Pool } = require('pg');
const p = new Pool({
    connectionString: 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db',
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const orderId = 'order_01KR9MYAEHARMYJ1PKBRP0SCBD';

        console.log('--- Search the order across all tables that have an order_id col ---');
        const cols = await p.query(`
            SELECT table_name FROM information_schema.columns
            WHERE table_schema='public' AND column_name='order_id'
        `);
        for (const { table_name } of cols.rows) {
            try {
                const r = await p.query(`SELECT count(*)::int as cnt FROM "${table_name}" WHERE order_id = $1`, [orderId]);
                if (r.rows[0].cnt > 0) {
                    console.log(`${table_name}: ${r.rows[0].cnt} rows`);
                }
            } catch (e) { /* ignore */ }
        }

        console.log('\n--- The order in "order" table (any way to find it) ---');
        let o = await p.query(`SELECT id, status, canceled_at, metadata FROM "order" WHERE id = $1`, [orderId]);
        console.log('exact id match rows:', o.rows.length);
        if (o.rows.length === 0) {
            o = await p.query(`SELECT id, status FROM "order" WHERE id LIKE $1 LIMIT 5`, [`%${orderId.slice(-12)}%`]);
            console.log('partial-id match rows:', o.rows);
        }

        console.log('\n--- Latest 5 orders in DB ---');
        const recent = await p.query(`SELECT id, status, created_at FROM "order" ORDER BY created_at DESC LIMIT 5`);
        console.log(recent.rows);

        console.log('\n--- Latest 5 return_request rows ---');
        const rr = await p.query(`SELECT id, order_id, status, created_at FROM return_request ORDER BY created_at DESC LIMIT 5`);
        console.log(rr.rows);
    } catch (e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        await p.end();
    }
})();
