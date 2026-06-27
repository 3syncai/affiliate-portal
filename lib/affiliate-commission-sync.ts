import { COMMISSION_HAS_ANY_RETURN_REQUEST_SQL } from "@/lib/dashboard-return-sql";
import { voidCommissionsForApprovedReturns } from "@/lib/void-return-commission";

type Queryable = {
    query: (text: string, params?: any[]) => Promise<any>;
};

type SyncOptions = {
    affiliateCode?: string;
    logPrefix: string;
};

/** Default post-delivery return window before commission credits (ecomm policy). */
export const COMMISSION_UNLOCK_DAYS = 7;

/** @deprecated Use COMMISSION_UNLOCK_DAYS; kept for dev smoke tests via env override. */
export const COMMISSION_UNLOCK_MINUTES = parsePositiveInt(
    process.env.COMMISSION_UNLOCK_MINUTES,
    0,
);

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** SQL interval for the unlock window (env: COMMISSION_UNLOCK_MINUTES for dev, else days). */
export function getCommissionUnlockIntervalSql(): string {
    const minutesOverride = parsePositiveInt(process.env.COMMISSION_UNLOCK_MINUTES, 0);
    if (minutesOverride > 0) {
        return `INTERVAL '${minutesOverride} minutes'`;
    }
    const days = parsePositiveInt(
        process.env.COMMISSION_UNLOCK_DAYS,
        COMMISSION_UNLOCK_DAYS,
    );
    return `INTERVAL '${days} days'`;
}

type PromotedCommissionRow = {
    commission_source: string;
    affiliate_user_id: string | null;
    affiliate_code: string | null;
    affiliate_commission: string | number | null;
};

async function creditWalletsForPromotedRows(
    db: Queryable,
    rows: PromotedCommissionRow[],
    logPrefix: string,
) {
    const branchTotals = new Map<string, number>();
    const asmTotals = new Map<string, number>();
    const stateTotals = new Map<string, number>();
    const affiliateTotals = new Map<string, number>();

    for (const row of rows) {
        const amount = Number.parseFloat(String(row.affiliate_commission ?? 0)) || 0;
        if (amount <= 0) continue;

        if (row.commission_source === "affiliate") {
            const referCode = String(row.affiliate_code ?? "").trim();
            if (referCode) {
                affiliateTotals.set(referCode, (affiliateTotals.get(referCode) ?? 0) + amount);
            }
            continue;
        }

        const userId = String(row.affiliate_user_id ?? "").trim();
        if (!userId) continue;

        if (row.commission_source === "branch_admin") {
            branchTotals.set(userId, (branchTotals.get(userId) ?? 0) + amount);
        } else if (
            row.commission_source === "area_manager" ||
            row.commission_source === "asm_direct"
        ) {
            asmTotals.set(userId, (asmTotals.get(userId) ?? 0) + amount);
        } else if (
            row.commission_source === "state_admin" ||
            row.commission_source === "state_admin_direct"
        ) {
            stateTotals.set(userId, (stateTotals.get(userId) ?? 0) + amount);
        }
    }

    for (const [userId, amount] of branchTotals) {
        await db.query(
            `
            INSERT INTO customer_wallet (customer_id, coins_balance)
            VALUES ($1::text, $2)
            ON CONFLICT (customer_id)
            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `,
            [userId, amount],
        );
    }

    for (const [userId, amount] of asmTotals) {
        await db.query(
            `
            INSERT INTO customer_wallet (customer_id, coins_balance)
            VALUES ($1::text, $2)
            ON CONFLICT (customer_id)
            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `,
            [userId, amount],
        );
    }

    for (const [userId, amount] of stateTotals) {
        await db.query(
            `
            INSERT INTO customer_wallet (customer_id, coins_balance)
            VALUES ($1::text, $2)
            ON CONFLICT (customer_id)
            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `,
            [userId, amount],
        );
    }

    for (const [referCode, amount] of affiliateTotals) {
        await db.query(
            `
            INSERT INTO customer_wallet (customer_id, coins_balance)
            SELECT id::text, $2 FROM affiliate_user WHERE refer_code = $1
            ON CONFLICT (customer_id)
            DO UPDATE SET coins_balance = customer_wallet.coins_balance + $2
            `,
            [referCode, amount],
        );
    }

    const credited =
        branchTotals.size +
        asmTotals.size +
        stateTotals.size +
        affiliateTotals.size;
    if (credited > 0) {
        console.log(`${logPrefix} credited ${credited} wallet(s) after unlock promotion`);
    }
}

export async function syncAffiliateCommissionStatuses(db: Queryable, options: SyncOptions) {
    const { affiliateCode, logPrefix } = options;
    const unlockInterval = getCommissionUnlockIntervalSql();

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

        if (deliveredConditions.length > 0) {
            await db.query(
                `
                UPDATE affiliate_commission_log acl
                SET unlock_at = ${deliveryAnchorSql} + ${unlockInterval}
                FROM "${orderTable}" o
                ${joinClause}
                WHERE o.id = acl.order_id
                  ${affiliateFilterClause}
                  AND acl.status = 'PENDING'
                  AND acl.unlock_at IS NULL
                  AND NOT (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL})
                  AND (${deliveredConditions.join(" OR ")})
            `,
                params
            );
        }

        const promotedResult = await db.query(
            `
            UPDATE affiliate_commission_log acl
            SET status = 'CREDITED',
                credited_at = COALESCE(acl.credited_at, NOW())
            WHERE acl.status = 'PENDING'
              AND acl.unlock_at IS NOT NULL
              AND acl.unlock_at <= NOW()
              AND NOT (${COMMISSION_HAS_ANY_RETURN_REQUEST_SQL})
              ${affiliateCode ? "AND acl.affiliate_code = $1" : ""}
            RETURNING acl.commission_source, acl.affiliate_user_id, acl.affiliate_code, acl.affiliate_commission
        `,
            params
        );

        if (promotedResult.rows?.length) {
            await creditWalletsForPromotedRows(
                db,
                promotedResult.rows as PromotedCommissionRow[],
                logPrefix,
            );
        }
    } catch (error) {
        console.error(`${logPrefix} status sync failed:`, error);
    }
}
