// Probe whether MEDUSA_DATABASE_URL is loaded the same way Next.js loads it.
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
}
const { Pool } = require('pg');

(async () => {
    console.log('MEDUSA_DATABASE_URL set?', Boolean(process.env.MEDUSA_DATABASE_URL));
    if (!process.env.MEDUSA_DATABASE_URL) return;

    const pool = new Pool({
        connectionString: process.env.MEDUSA_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    const orderIds = [
        'order_01KR9NSK6VSMBEF895MT3Q05ZW',
        'order_01KR9MYAEHARMYJ1PKBRP0SCBD',
    ];
    const r = await pool.query(
        `
        SELECT DISTINCT rr.order_id
        FROM return_request rr
        WHERE rr.order_id = ANY($1::text[])
          AND rr.deleted_at IS NULL
          AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
        `,
        [orderIds]
    );
    console.log('returns from medusa:', r.rows);
    await pool.end();
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
