const { Pool } = require('pg');
const p = new Pool({
    connectionString: 'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db',
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('--- All tables in public ---');
        let r = await p.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='public'
              AND (table_name ILIKE '%return%' OR table_name ILIKE '%refund%' OR table_name ILIKE '%order%' OR table_name ILIKE '%request%' OR table_name ILIKE '%cancel%')
            ORDER BY table_name
        `);
        console.log(r.rows.map(x => x.table_name));

        console.log('\n--- recent rows in candidate tables (last 24h) ---');
        for (const t of r.rows.map(x => x.table_name)) {
            try {
                const cols = await p.query(
                    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
                    [t]
                );
                const colSet = new Set(cols.rows.map(c => c.column_name));
                if (!colSet.has('created_at')) continue;
                const orderRefCol =
                    colSet.has('order_id') ? 'order_id' :
                    colSet.has('order_display_id') ? 'order_display_id' : null;
                const x = await p.query(
                    `SELECT * FROM "${t}" WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 3`
                );
                if (x.rows.length === 0) continue;
                console.log(`\n-- ${t} (orderCol=${orderRefCol}) --`);
                for (const row of x.rows) {
                    const trimmed = {};
                    for (const k of Object.keys(row)) {
                        if (['id', 'order_id', 'status', 'created_at', 'customer_id', 'reason'].includes(k)) {
                            trimmed[k] = row[k];
                        }
                    }
                    console.log(trimmed);
                }
            } catch (e) {
                // ignore
            }
        }

        console.log('\n--- search for testing231 customer recent orders ---');
        const customer = await p.query(
            `SELECT id, email, first_name FROM customer WHERE email ILIKE '%testing231%' LIMIT 5`
        );
        console.log(customer.rows);
        for (const c of customer.rows) {
            const orders = await p.query(
                `SELECT id, status, created_at, canceled_at, metadata FROM "order" WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 3`,
                [c.id]
            );
            console.log(`orders for ${c.email}:`, orders.rows);
        }
    } catch (e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        await p.end();
    }
})();
