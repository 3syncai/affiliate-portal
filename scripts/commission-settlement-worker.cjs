/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node worker. */
require('./register-portal-ts');
const pool = require('../lib/db.ts').default;
const { syncAffiliateCommissionStatuses } = require('../lib/affiliate-commission-sync.ts');
const once = process.argv.includes('--once');
const check = process.argv.includes('--check');
const intervalMs = 30_000;
let stopping = false;
let timer;
let wake;
function stop() {
  stopping = true;
  clearTimeout(timer);
  if (wake) wake();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
async function main() {
  if (check) {
    const { rows } = await pool.query(`SELECT last_success_at, last_error_at,
      (last_error IS NULL AND last_success_at > NOW() - INTERVAL '5 minutes') AS healthy
      FROM partner_commission_settlement_worker WHERE worker_name = 'commission'`);
    console.log(JSON.stringify({ worker: 'commission', ...rows[0] }));
    if (!rows[0]?.healthy) process.exitCode = 1;
    return;
  }
  do {
    const started = Date.now();
    try {
      const result = await syncAffiliateCommissionStatuses(pool, {
        logPrefix: '[Commission Worker]', throwOnError: true,
      });
      if (!result.skipped) {
        await pool.query(`INSERT INTO partner_commission_settlement_worker
          (worker_name, last_success_at, duration_ms) VALUES ('commission', NOW(), $1)
          ON CONFLICT (worker_name) DO UPDATE SET last_success_at = EXCLUDED.last_success_at,
          duration_ms = EXCLUDED.duration_ms, last_error = NULL`, [Date.now() - started]);
      }
      console.log(JSON.stringify({ worker: 'commission', skipped: Boolean(result.skipped), duration_ms: Date.now() - started }));
    } catch (error) {
      console.error('[Commission Worker] tick failed:', error);
      await pool.query(`INSERT INTO partner_commission_settlement_worker (worker_name, last_error_at, last_error)
        VALUES ('commission', NOW(), $1) ON CONFLICT (worker_name) DO UPDATE
        SET last_error_at = EXCLUDED.last_error_at, last_error = EXCLUDED.last_error`,
        [error instanceof Error ? error.name : 'SettlementError']).catch(() => {});
      if (once) throw error;
    }
    if (once || stopping) break;
    await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, intervalMs); });
    wake = undefined;
  } while (!stopping);
}
main().catch(() => { process.exitCode = 1; }).finally(() => pool.end());
