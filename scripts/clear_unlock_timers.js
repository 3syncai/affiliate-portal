/*
 * One-shot maintenance script.
 *
 * Removes the post-delivery 5-minute "unlock" timer data from the live DB:
 *   1. Promotes every PENDING row that is currently in the countdown
 *      (status='PENDING' AND unlock_at IS NOT NULL) to CREDITED.
 *   2. Clears unlock_at on every row so the column carries no timer data.
 *
 * Safe to run multiple times. Does NOT touch customer_wallet — wallets are
 * already credited inline by the delivery webhooks (see the comment in
 * lib/affiliate-commission-sync.ts), so flipping the log row is the only
 * thing standing between the user and their balance.
 *
 * Trigger note: enforce_commission_unlock_delay_trigger rewrites any naive
 * status='CREDITED' write back to PENDING + a fresh 5-minute unlock_at when
 * NEW.unlock_at IS NULL or > NOW(). We work around this by setting
 * unlock_at = NOW() - 1 second in the same UPDATE; that path is explicitly
 * allowed by the trigger. After the row is CREDITED the trigger early-returns
 * on subsequent UPDATEs (OLD.status='CREDITED'), so we can safely null the
 * column in a second pass.
 *
 * Usage:
 *   node scripts/clear_unlock_timers.js          # apply
 *   node scripts/clear_unlock_timers.js --dry    # report only, no writes
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        throw new Error('DATABASE_URL not set and .env not found at project root');
    }

    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        if (key !== 'DATABASE_URL') continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        return value;
    }
    throw new Error('DATABASE_URL not present in .env');
}

async function main() {
    const dryRun = process.argv.includes('--dry') || process.argv.includes('--dry-run');

    const connectionString = loadDatabaseUrl();
    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('rds.amazonaws.com')
            ? { rejectUnauthorized: false }
            : false,
    });

    const client = await pool.connect();
    try {
        const before = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE unlock_at IS NOT NULL)                                            AS rows_with_timer,
                COUNT(*) FILTER (WHERE status = 'PENDING' AND unlock_at IS NOT NULL)                     AS pending_in_countdown,
                COUNT(*) FILTER (WHERE status = 'PENDING' AND unlock_at IS NOT NULL AND unlock_at > NOW()) AS countdown_still_running,
                COUNT(*) FILTER (WHERE status = 'PENDING' AND unlock_at IS NOT NULL AND unlock_at <= NOW()) AS countdown_already_elapsed,
                COUNT(*) FILTER (WHERE status = 'CREDITED' AND unlock_at IS NOT NULL)                    AS credited_with_stale_timer,
                COUNT(*) FILTER (WHERE status = 'CANCELLED' AND unlock_at IS NOT NULL)                   AS cancelled_with_stale_timer
            FROM affiliate_commission_log
        `);

        const stats = before.rows[0];
        console.log('--- Current unlock_at state ---');
        console.log(`  rows with any timer:          ${stats.rows_with_timer}`);
        console.log(`  PENDING in countdown:         ${stats.pending_in_countdown}`);
        console.log(`    countdown still running:    ${stats.countdown_still_running}`);
        console.log(`    countdown already elapsed:  ${stats.countdown_already_elapsed}`);
        console.log(`  CREDITED with stale timer:    ${stats.credited_with_stale_timer}`);
        console.log(`  CANCELLED with stale timer:   ${stats.cancelled_with_stale_timer}`);

        if (Number(stats.rows_with_timer) === 0) {
            console.log('\nNo timer data to clear. Nothing to do.');
            return;
        }

        if (dryRun) {
            console.log('\n--dry passed: not writing any changes.');
            return;
        }

        await client.query('BEGIN');

        const promote = await client.query(`
            UPDATE affiliate_commission_log
            SET status = 'CREDITED',
                unlock_at = NOW() - INTERVAL '1 second',
                credited_at = COALESCE(credited_at, NOW())
            WHERE status = 'PENDING'
              AND unlock_at IS NOT NULL
            RETURNING id, order_id, affiliate_code, affiliate_commission
        `);

        console.log(`\nPromoted ${promote.rowCount} PENDING row(s) to CREDITED.`);
        for (const row of promote.rows) {
            console.log(
                `  - log#${row.id} order=${row.order_id} affiliate=${row.affiliate_code} ₹${row.affiliate_commission}`
            );
        }

        const cleared = await client.query(`
            UPDATE affiliate_commission_log
            SET unlock_at = NULL
            WHERE unlock_at IS NOT NULL
            RETURNING id, status
        `);

        const byStatus = cleared.rows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
        console.log(`\nCleared unlock_at on ${cleared.rowCount} row(s):`, byStatus);

        const after = await client.query(`
            SELECT COUNT(*) AS remaining_with_timer
            FROM affiliate_commission_log
            WHERE unlock_at IS NOT NULL
        `);

        if (Number(after.rows[0].remaining_with_timer) !== 0) {
            throw new Error(
                `unlock_at still set on ${after.rows[0].remaining_with_timer} row(s) after cleanup; aborting.`
            );
        }

        await client.query('COMMIT');
        console.log('\nDone. unlock_at column carries no timer data; pending commissions are now CREDITED.');
        console.log('Note: the trigger and column remain in place for future orders.');
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // pool/client may already be closed
        }
        console.error('Failed:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
