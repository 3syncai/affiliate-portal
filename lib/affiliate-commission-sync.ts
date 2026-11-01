import { withCommissionSettlementTransaction } from "@/lib/commission-settlement-transaction";
import type { Pool } from "pg";
import { creditDueCommissions, cancelCommissionRows } from "@/lib/commission-wallet-ledger";
import { repairMissingBranchAdminCommissions } from "@/lib/repair-branch-admin-commissions";
import { COMMISSION_HAS_ANY_RETURN_REQUEST_SQL } from "@/lib/dashboard-return-sql";
import { voidCommissionsForApprovedReturns } from "@/lib/void-return-commission";

type Queryable = Pick<Pool, "query">;

type SyncOptions = {
    affiliateCode?: string;
    logPrefix: string;
    throwOnError?: boolean;
};

async function synchronizeInTransaction(db: Queryable, options: SyncOptions) {
    const { affiliateCode, logPrefix } = options;

    try {
        const orderTableRes = await db.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('order', 'orders')
            LIMIT 1
        `
        );

        if (orderTableRes.rows.length === 0) {
            console.warn(`${logPrefix} status sync skipped: order table not found`);
            throw new Error("Settlement requires an order table");
        }

        const orderTable = orderTableRes.rows[0].table_name;
        const orderColsRes = await db.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
        `,
            [orderTable]
        );
        const orderCols = new Set(orderColsRes.rows.map((row: { column_name: string }) => row.column_name));

        await voidCommissionsForApprovedReturns(db, {
            affiliateCode,
            logPrefix: `${logPrefix} approved-return`,
        });

        const returnConditionParts: string[] = [];
        const returnTableExists = await db.query(
            `SELECT 1
             FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'return'
             LIMIT 1`
        );
        if (returnTableExists.rows.length > 0) {
            returnConditionParts.push(`
                EXISTS (
                    SELECT 1
                    FROM "return" r
                    WHERE r.order_id = o.id
                      AND r.deleted_at IS NULL
                      AND r.canceled_at IS NULL
                )
            `);
        }

        const deliveredConditions: string[] = [];
        const cancelledConditions: string[] = [...returnConditionParts];

        if (orderCols.has("status")) {
            deliveredConditions.push("LOWER(COALESCE(o.status::text, '')) IN ('completed')");
            cancelledConditions.push("LOWER(COALESCE(o.status::text, '')) IN ('canceled','cancelled','cancellation_requested')");
        }
        if (orderCols.has("fulfillment_status")) {
            deliveredConditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('delivered','fulfilled')");
            cancelledConditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('canceled','cancelled')");
        }
        if (orderCols.has("payment_status")) {
            cancelledConditions.push("LOWER(COALESCE(o.payment_status::text, '')) IN ('canceled','cancelled','refunded','partially_refunded')");
        }
        if (orderCols.has("canceled_at")) {
            cancelledConditions.push("o.canceled_at IS NOT NULL");
        }
        if (orderCols.has("metadata")) {
            deliveredConditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'delivered'");
            deliveredConditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'fulfilled'");
            deliveredConditions.push("o.metadata->>'shiprocket_delivered_at' IS NOT NULL");
            cancelledConditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'cancelled'");
            cancelledConditions.push("COALESCE(o.metadata->>'shiprocket_status', '') ILIKE 'canceled'");
            cancelledConditions.push("o.metadata->>'shiprocket_cancelled_at' IS NOT NULL");
        }

        let joinClause = "";
        let hasFulfillmentDeliveredAt = false;
        const fulfillmentTableRes = await db.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'fulfillment'
            LIMIT 1
        `
        );

        if (fulfillmentTableRes.rows.length > 0) {
            const fulfillmentColsRes = await db.query(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'fulfillment'
            `
            );
            const fulfillmentCols = new Set(
                fulfillmentColsRes.rows.map((row: { column_name: string }) => row.column_name)
            );

            if (fulfillmentCols.has("order_id")) {
                joinClause = "LEFT JOIN fulfillment f ON f.order_id = o.id";
            } else {
                const orderFulfillmentTableRes = await db.query(
                    `
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'order_fulfillment'
                    LIMIT 1
                `
                );

                if (orderFulfillmentTableRes.rows.length > 0) {
                    joinClause = `
                    LEFT JOIN order_fulfillment ofl ON ofl.order_id = o.id
                    LEFT JOIN fulfillment f ON f.id = ofl.fulfillment_id
                `;
                }
            }

            if (joinClause) {
                if (fulfillmentCols.has("delivered_at")) {
                    hasFulfillmentDeliveredAt = true;
                    deliveredConditions.push("f.delivered_at IS NOT NULL");
                }
                if (fulfillmentCols.has("status")) {
                    deliveredConditions.push("LOWER(COALESCE(f.status::text, '')) IN ('delivered','fulfilled')");
                    cancelledConditions.push("LOWER(COALESCE(f.status::text, '')) IN ('canceled','cancelled')");
                }
                if (fulfillmentCols.has("canceled_at")) {
                    cancelledConditions.push("f.canceled_at IS NOT NULL");
                }
            }
        }

        const affiliateFilterClause = affiliateCode ? "AND acl.affiliate_code = $1" : "";
        const params = affiliateCode ? [affiliateCode] : [];

        const deliveryAnchorSql = hasFulfillmentDeliveredAt
            ? `COALESCE(
                f.delivered_at,
                NULLIF(o.metadata->>'shiprocket_delivered_at', '')::timestamptz,
                NOW()
              )`
            : `COALESCE(
                NULLIF(o.metadata->>'shiprocket_delivered_at', '')::timestamptz,
                NOW()
              )`;

        if (cancelledConditions.length > 0) {
            const cancelled = await db.query(
                `SELECT DISTINCT acl.id::text AS id FROM affiliate_commission_log acl
                 JOIN "${orderTable}" o ON o.id = acl.order_id ${joinClause}
                 WHERE (acl.status IS DISTINCT FROM 'CANCELLED' OR EXISTS (
                     SELECT 1 FROM partner_commission_wallet_ledger wl
                     WHERE wl.commission_id = acl.id::text AND wl.reversed_at IS NULL))
                   ${affiliateFilterClause} AND (${cancelledConditions.join(" OR ")})`, params);
            await cancelCommissionRows(db, cancelled.rows.map(row => row.id));
        }

        if (deliveredConditions.length > 0) {
            await db.query(
                `
                UPDATE affiliate_commission_log acl
                SET policy_delivered_at = COALESCE(acl.policy_delivered_at, ${deliveryAnchorSql}),
                    policy_hold_days = resolve_commission_hold_days(acl.order_id),
                    unlock_at = COALESCE(acl.policy_delivered_at, ${deliveryAnchorSql})
                        + resolve_commission_hold_days(acl.order_id) * INTERVAL '1 day'
                FROM "${orderTable}" o
                ${joinClause}
                WHERE o.id = acl.order_id
                  ${affiliateFilterClause}
                  AND acl.status = 'PENDING'
                  AND acl.policy_hold_days IS NULL
                  AND NOT (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL})
                  AND (${deliveredConditions.join(" OR ")})
            `,
                params
            );
        }

        await creditDueCommissions(db, COMMISSION_HAS_ANY_RETURN_REQUEST_SQL, affiliateCode);

    } catch (error) {
        console.error(`${logPrefix} status sync failed:`, error);
        throw error;
    }
}

/** Worker entry point: one connection, one transaction, one cross-process lock. */
export async function syncAffiliateCommissionStatuses(pool: Pick<Pool, "connect">, options: SyncOptions) {
    try {
        return await withCommissionSettlementTransaction(pool, async client => {
            await repairMissingBranchAdminCommissions(client, { logPrefix: options.logPrefix, batchLimit: 100 });
            await synchronizeInTransaction(client, { ...options, throwOnError: true });
        });
    } catch (error) {
        if (options.throwOnError) throw error;
        console.error(`${options.logPrefix} settlement transaction failed:`, error);
        return { failed: true, skipped: false };
    }
}
