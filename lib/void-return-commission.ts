import { withCommissionSettlementTransaction } from "@/lib/commission-settlement-transaction";
import { cancelCommissionRows } from "@/lib/commission-wallet-ledger";
import {
  RETURN_REQUEST_APPROVED_STATUSES,
  returnStatusSqlList,
} from "@/lib/return-request-status";

type Queryable = Pick<import("pg").Pool, "query">;

type VoidOptions = {
  affiliateCode?: string;
  orderId?: string;
  logPrefix?: string;
};

const APPROVED_RETURN_SQL = returnStatusSqlList(RETURN_REQUEST_APPROVED_STATUSES);

/**
 * When an admin approves a customer return, void every commission row for
 * that order: pending amount becomes 0, the unlock timer is cleared, and
 * the row is marked CANCELLED (UI shows RETURNED via has_return).
 */
export async function voidCommissionsForApprovedReturns(
  db: Queryable,
  options: VoidOptions = {},
): Promise<number> {
  const { affiliateCode, orderId, logPrefix = "[Return Void]" } = options;

  const filters: string[] = [
    `(acl.status IS DISTINCT FROM 'CANCELLED' OR EXISTS (
      SELECT 1 FROM partner_commission_wallet_ledger wl
      WHERE wl.commission_id = acl.id::text AND wl.reversed_at IS NULL))`,
    `EXISTS (
      SELECT 1
      FROM return_request rr
      WHERE rr.order_id = acl.order_id
        AND rr.deleted_at IS NULL
        AND LOWER(COALESCE(rr.status, '')) IN (${APPROVED_RETURN_SQL})
    )`,
  ];
  const params: unknown[] = [];

  if (affiliateCode) {
    params.push(affiliateCode);
    filters.push(`acl.affiliate_code = $${params.length}`);
  }

  if (orderId) {
    params.push(orderId);
    filters.push(`acl.order_id = $${params.length}`);
  }

  const selectResult = await db.query(
    `
    SELECT acl.id, acl.affiliate_code, acl.affiliate_commission, acl.status
    FROM affiliate_commission_log acl
    WHERE ${filters.join(" AND ")}
    `,
    params,
  );

  const rows = selectResult.rows as Array<{
    id: string;
    affiliate_code: string;
    affiliate_commission: string | number | null;
    status: string;
  }>;

  if (rows.length === 0) {
    return 0;
  }

  const updated = await cancelCommissionRows(db, rows.map(row => String(row.id)));

  if (updated > 0) {
    console.log(
      `${logPrefix} voided ${updated} commission row(s) for approved return`,
    );
  }

  return updated;
}

/** Mutation webhook keeps immediate voiding, atomically serialized with the worker. */
export async function voidApprovedReturnCommissions(pool: Pick<import("pg").Pool, "connect">, options: VoidOptions) {
  const result = await withCommissionSettlementTransaction(pool,
    client => voidCommissionsForApprovedReturns(client, options), true);
  if (result.skipped) throw new Error("Unable to acquire commission settlement lock");
  return result.value;
}
