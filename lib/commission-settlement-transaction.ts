import type { Pool, PoolClient } from "pg";

/** All wallet settlement writers share the same DB lock and dedicated connection. */
export async function withCommissionSettlementTransaction<T>(
    pool: Pick<Pool, "connect">,
    operation: (client: PoolClient) => Promise<T>,
    waitForLock = false,
) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '30s'");
        const lock = await client.query(waitForLock
            ? "SELECT pg_advisory_xact_lock(726394281), true AS acquired"
            : "SELECT pg_try_advisory_xact_lock(726394281) AS acquired");
        if (!lock.rows[0].acquired) {
            await client.query("ROLLBACK");
            return { skipped: true as const };
        }
        await client.query("SELECT commission_id FROM partner_commission_wallet_ledger LIMIT 0");
        const value = await operation(client);
        await client.query("COMMIT");
        return { skipped: false as const, value };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}
