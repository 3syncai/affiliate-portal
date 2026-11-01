import type { Pool } from "pg";
import { CommissionPoolValidationError, NORMAL_COMMISSION_ROLES, normalCommissionPool, parseCommissionRateUpdates } from "./commission-pool";

export async function updateCommissionRates(pool: Pick<Pool, "connect">, input: unknown) {
  const updates = parseCommissionRateUpdates(input);
  const normalChanged = updates.some(row => (NORMAL_COMMISSION_ROLES as readonly string[]).includes(row.role_type));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent settings saves before reading/merging partial updates.
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE");
    const { rows } = await client.query("SELECT role_type, commission_percentage FROM commission_rates");
    const current = Object.fromEntries(rows.map(row => [row.role_type, row.commission_percentage]));
    for (const row of updates) {
      if (!(row.role_type in current)) throw new CommissionPoolValidationError(`Commission role ${row.role_type} is not configured.`);
      current[row.role_type] = row.commission_percentage;
    }
    if (normalChanged) {
      const state = normalCommissionPool(current);
      if (!state.valid) throw new CommissionPoolValidationError(state.error);
    }
    for (const row of updates) {
      const result = await client.query("UPDATE commission_rates SET commission_percentage=$1 WHERE role_type=$2", [row.commission_percentage, row.role_type]);
      if (result.rowCount !== 1) throw new CommissionPoolValidationError(`Commission role ${row.role_type} must have exactly one configured rate.`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
