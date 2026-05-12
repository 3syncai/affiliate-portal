const { Pool } = require('pg');

const dbs = {
    'affiliate-portal (cz282guu85co)':
        'postgres://postgres:Oweg4719@oweg-ecom.cz282guu85co.ap-south-1.rds.amazonaws.com:5432/oweg_db',
    'medusa (cjqaso6gs3gz)':
        'postgres://postgres:Oweg4719@oweg-ecom.cjqaso6gs3gz.ap-south-1.rds.amazonaws.com:5432/oweg_db',
};

(async () => {
    for (const [label, conn] of Object.entries(dbs)) {
        const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
        try {
            console.log(`\n=== ${label} ===`);
            const orderCount = await pool.query(`SELECT count(*)::int AS c FROM "order"`).catch(() => ({ rows: [{ c: 'no table' }] }));
            console.log(`  order rows: ${orderCount.rows[0].c}`);
            const rrCount = await pool.query(`SELECT count(*)::int AS c FROM return_request`).catch(() => ({ rows: [{ c: 'no table' }] }));
            console.log(`  return_request rows: ${rrCount.rows[0].c}`);
            const aclCount = await pool.query(`SELECT count(*)::int AS c FROM affiliate_commission_log`).catch(() => ({ rows: [{ c: 'no table' }] }));
            console.log(`  affiliate_commission_log rows: ${aclCount.rows[0].c}`);

            const targetOrder = await pool.query(
                `SELECT id, status, canceled_at FROM "order" WHERE id = $1`,
                ['order_01KR9MYAEHARMYJ1PKBRP0SCBD']
            ).catch(() => ({ rows: [] }));
            console.log(`  has target order: ${targetOrder.rows.length > 0 ? JSON.stringify(targetOrder.rows[0]) : 'no'}`);

            const targetRR = await pool.query(
                `SELECT id, status, created_at FROM return_request WHERE order_id = $1 ORDER BY created_at DESC LIMIT 3`,
                ['order_01KR9MYAEHARMYJ1PKBRP0SCBD']
            ).catch(() => ({ rows: [] }));
            console.log(`  return_requests for target order: ${targetRR.rows.length}`, targetRR.rows);

            const recentRR = await pool.query(
                `SELECT id, order_id, status, created_at FROM return_request ORDER BY created_at DESC LIMIT 3`
            ).catch(() => ({ rows: [] }));
            console.log(`  most recent return_requests overall:`, recentRR.rows);
        } finally {
            await pool.end();
        }
    }
})();
