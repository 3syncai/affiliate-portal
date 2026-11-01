/* eslint-disable @typescript-eslint/no-require-imports -- Explicit deployment migration. */
const fs = require('node:fs');
const path = require('node:path');
require('./register-portal-ts');
const pool = require('../lib/db.ts').default;
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required; stop old settlement writers first.');
  const client = await pool.connect();
  try {
    // Migration includes BEGIN/COMMIT and must use one dedicated connection.
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/add_commission_wallet_ledger.sql'), 'utf8'));
    console.log('Commission wallet ledger migration complete. Historical wallet balances unchanged.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
