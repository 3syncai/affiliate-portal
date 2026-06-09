import { voidCommissionsForApprovedReturns } from "@/lib/void-return-commission";

type Queryable = {
    query: (text: string, params?: any[]) => Promise<any>;
};

type SyncOptions = {
    affiliateCode?: string;
    logPrefix: string;
};

// Number of minutes between an order being delivered and the commission
// becoming spendable in the affiliate's wallet. The UI shows a live countdown
// while the row is in this "awaiting credit" state.
export const COMMISSION_UNLOCK_MINUTES = 5;

export async function syncAffiliateCommissionStatuses(db: Queryable, options: SyncOptions) {
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
            return;
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

        // Admin-approved returns are voided first (stops timer, zeros pending).
        // Customer requests still awaiting approval keep the countdown running.
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
            deliveredConditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('delivered','fulfilled','shipped')");
            cancelledConditions.push("LOWER(COALESCE(o.fulfillment_status::text, '')) IN ('canceled','cancelled')");
        }
        if (orderCols.has("payment_status")) {
            deliveredConditions.push("LOWER(COALESCE(o.payment_status::text, '')) IN ('captured','partially_captured')");
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
                    deliveredConditions.push("f.delivered_at IS NOT NULL");
                }
                if (fulfillmentCols.has("shipped_at")) {
                    deliveredConditions.push("f.shipped_at IS NOT NULL");
                }
                if (fulfillmentCols.has("status")) {
                    deliveredConditions.push("LOWER(COALESCE(f.status::text, '')) IN ('delivered','fulfilled','shipped')");
                    cancelledConditions.push("LOWER(COALESCE(f.status::text, '')) IN ('canceled','cancelled')");
                }
                if (fulfillmentCols.has("canceled_at")) {
                    cancelledConditions.push("f.canceled_at IS NOT NULL");
                }
            }
        }

        const affiliateFilterClause = affiliateCode ? "AND acl.affiliate_code = $1" : "";
        const params = affiliateCode ? [affiliateCode] : [];

        // 1) Cancellations and returns always win — clear any unlock timer
        //    and zero out the commission so a cancelled / returned order
        //    doesn't drip into the wallet (even mid-countdown).
        if (cancelledConditions.length > 0) {
            await db.query(
                `
                UPDATE affiliate_commission_log acl
                SET status = 'CANCELLED',
                    affiliate_commission = 0,
                    additional_commission_amount = 0,
                    credited_at = NULL,
                    unlock_at = NULL
                FROM "${orderTable}" o
                ${joinClause}
                WHERE o.id = acl.order_id
                  ${affiliateFilterClause}
                  AND acl.status IS DISTINCT FROM 'CANCELLED'
                  AND (${cancelledConditions.join(" OR ")})
            `,
                params
            );
        }

        // 2) Mark delivered-but-not-yet-credited rows with an unlock timer.
        //    Status stays PENDING so the UI can show a countdown badge.
        if (deliveredConditions.length > 0) {
            await db.query(
                `
                UPDATE affiliate_commission_log acl
                SET unlock_at = NOW() + INTERVAL '${COMMISSION_UNLOCK_MINUTES} minutes'
                FROM "${orderTable}" o
                ${joinClause}
                WHERE o.id = acl.order_id
                  ${affiliateFilterClause}
                  AND acl.status = 'PENDING'
                  AND acl.unlock_at IS NULL
                  AND (${deliveredConditions.join(" OR ")})
            `,
                params
            );
        }

        // 3) Promote any PENDING row whose unlock timer has elapsed into
        //    CREDITED. This is what actually moves the amount into the
        //    affiliate's wallet balance shown in the dashboard (which is
        //    derived from `affiliate_commission_log.status='CREDITED'`).
        //    The customer_wallet table is updated inline by the existing
        //    webhooks at delivery time, so we deliberately don't touch it
        //    here to avoid double-crediting.
        await db.query(
            `
            UPDATE affiliate_commission_log acl
            SET status = 'CREDITED',
                credited_at = COALESCE(acl.credited_at, NOW())
            WHERE acl.status = 'PENDING'
              AND acl.unlock_at IS NOT NULL
              AND acl.unlock_at <= NOW()
              ${affiliateCode ? "AND acl.affiliate_code = $1" : ""}
        `,
            params
        );
    } catch (error) {
        console.error(`${logPrefix} status sync failed:`, error);
    }
}
