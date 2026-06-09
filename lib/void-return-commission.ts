import {
  RETURN_REQUEST_APPROVED_STATUSES,
  returnStatusSqlList,
} from "@/lib/return-request-status";

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
};

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
    "acl.status IS DISTINCT FROM 'CANCELLED'",
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

  const updateResult = await db.query(
    `
    UPDATE affiliate_commission_log acl
    SET status = 'CANCELLED',
        affiliate_commission = 0,
        additional_commission_amount = 0,
        credited_at = NULL,
        unlock_at = NULL
    WHERE ${filters.join(" AND ")}
    RETURNING id, affiliate_code
    `,
    params,
  );

  for (const row of rows) {
    const amount = parseFloat(String(row.affiliate_commission ?? "0"));
    if (amount <= 0) continue;

    try {
      await db.query(
        `
        UPDATE customer_wallet
        SET coins_balance = GREATEST(0, coins_balance - $2)
        WHERE customer_id = (
          SELECT id FROM affiliate_user WHERE refer_code = $1 LIMIT 1
        )
        `,
        [row.affiliate_code, amount],
      );
    } catch (walletError) {
      console.error(
        `${logPrefix} wallet reversal failed for ${row.affiliate_code}:`,
        walletError,
      );
    }
  }

  const updated = updateResult.rowCount ?? rows.length;
  if (updated > 0) {
    console.log(
      `${logPrefix} voided ${updated} commission row(s) for approved return`,
    );
  }

  return updated;
}
