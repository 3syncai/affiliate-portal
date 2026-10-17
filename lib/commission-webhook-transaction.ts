import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export class CommissionEventConflict extends Error {}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

/** The receipt and every commission write must use the same checked-out client. */
export async function receiveCommissionEvent<T extends { status: number }>(
  db: Pool,
  payload: Record<string, unknown>,
  headerKey: string | null,
  processEvent: (client: PoolClient, afterCommit: (notify: () => void) => void) => Promise<T>,
  duplicate: () => T,
): Promise<T> {
  const bodyKey = typeof payload.event_id === "string" ? payload.event_id.trim() : "";
  const eventId = (headerKey || bodyKey || "").trim();
  if ((headerKey && bodyKey && headerKey.trim() !== bodyKey) || eventId.length > 200) {
    throw new CommissionEventConflict("Invalid or mismatched commission event ID");
  }
  const hash = createHash("sha256").update(canonical(payload)).digest("hex");
  const client = await db.connect();
  const notifications: Array<() => void> = [];
  let committed = false;
  try {
    await client.query("BEGIN");
    // Also serialize legacy callers that do not supply an event ID.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["commission:" + String(payload.order_id || "").trim()]);
    if (eventId) {
      const claim = await client.query(`
        INSERT INTO affiliate_commission_webhook_event(event_id, payload_hash, order_id)
        VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING RETURNING event_id
      `, [eventId, hash, String(payload.order_id || "").trim()]);
      if (!claim.rowCount) {
        const existing = await client.query("SELECT payload_hash FROM affiliate_commission_webhook_event WHERE event_id = $1", [eventId]);
        if (existing.rows[0]?.payload_hash !== hash) throw new CommissionEventConflict("Commission event ID reused with different payload");
        await client.query("ROLLBACK");
        return duplicate();
      }
    }
    const response = await processEvent(client, notify => notifications.push(notify));
    if (response.status >= 400) {
      await client.query("ROLLBACK");
      return response;
    }
    const commit = await client.query("COMMIT");
    if (commit.command !== "COMMIT") throw new Error("Commission transaction did not commit");
    committed = true;
    for (const notify of notifications) {
      try { notify(); } catch (error) { console.error("Commission notification failed after commit", error); }
    }
    return response;
  } catch (error) {
    if (!committed) {
      try { await client.query("ROLLBACK"); } catch { /* Connection loss already rolls back server-side. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
