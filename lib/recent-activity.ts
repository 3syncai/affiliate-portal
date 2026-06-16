import type { Pool } from "pg";
import type { RecentActivityFeedItem } from "@/components/dashboard/RecentActivityFeed";

export type ActivityCategory =
    | "commission"
    | "approval"
    | "rejection"
    | "request"
    | "cancellation"
    | "return"
    | "withdrawal"
    | "payment"
    | "notification"
    | "referral";

export type ActivityEvent = {
    id: string;
    category: ActivityCategory;
    timestamp: string;
    actorName: string;
    action: string;
    subtitle?: string;
    amount?: number | null;
    saleLevel?: string;
    territory?: string;
};

const toAmount = (value: string | number | null | undefined) =>
    Number.parseFloat(String(value ?? 0)) || 0;

const fullName = (first?: string | null, last?: string | null, fallback = "User") =>
    `${first ?? ""} ${last ?? ""}`.trim() || fallback;

export function saleLevelFromSource(source?: string | null): string {
    switch (source) {
        case "affiliate":
            return "Sales Executive Sale";
        case "branch_admin":
            return "ASM Sale";
        case "area_manager":
            return "Branch Manager Sale";
        case "state_admin":
        case "state_admin_direct":
            return "State Head Sale";
        case "asm_direct":
            return "Branch Manager Direct Sale";
        default:
            return "Commission";
    }
}

export function sortAndLimit(events: ActivityEvent[], limit: number): ActivityEvent[] {
    return [...events]
        .sort(
            (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, limit);
}

export function mapActivityEventToFeedItem(event: ActivityEvent): RecentActivityFeedItem {
    const variantMap: Record<
        ActivityCategory,
        NonNullable<RecentActivityFeedItem["variant"]>
    > = {
        commission: "commission",
        approval: "approval",
        rejection: "rejection",
        request: "request",
        cancellation: "cancellation",
        return: "return",
        withdrawal: "withdrawal",
        payment: "payment",
        notification: "notification",
        referral: "referral",
    };

    const subtitleParts = [event.subtitle, event.saleLevel, event.territory].filter(
        Boolean,
    );

    return {
        id: event.id,
        name: event.actorName,
        action: event.action,
        subtitle: subtitleParts.length ? subtitleParts.join(" · ") : undefined,
        amount: event.amount ?? null,
        timestamp: event.timestamp,
        variant: variantMap[event.category],
    };
}

async function fetchCommissionEvents(
    pool: Pool,
    whereClause: string,
    params: unknown[],
    territoryKey: string,
    limit = 30,
): Promise<ActivityEvent[]> {
    const result = await pool.query(
        `
        SELECT
            acl.id,
            acl.order_id,
            acl.product_name,
            acl.status,
            acl.commission_source,
            acl.created_at,
            COALESCE(acl.affiliate_commission, acl.commission_amount, 0) AS amount,
            COALESCE(
                u.first_name,
                ba.first_name,
                asm.first_name,
                sa_direct.first_name,
                NULLIF(SPLIT_PART(TRIM(acl.customer_name), ' ', 1), ''),
                'User'
            ) AS first_name,
            COALESCE(
                u.last_name,
                ba.last_name,
                asm.last_name,
                sa_direct.last_name,
                NULLIF(
                    TRIM(
                        SUBSTRING(
                            TRIM(acl.customer_name)
                            FROM POSITION(' ' IN TRIM(acl.customer_name)) + 1
                        )
                    ),
                    ''
                ),
                ''
            ) AS last_name,
            COALESCE(
                u.branch,
                ba.branch,
                TRIM(CONCAT(asm.city, ', ', asm.state)),
                u2.branch
            ) AS territory
        FROM affiliate_commission_log acl
        LEFT JOIN affiliate_user u ON acl.commission_source = 'affiliate' AND u.refer_code = acl.affiliate_code
        LEFT JOIN branch_admin ba ON acl.commission_source = 'branch_admin'
            AND (
                NULLIF(acl.affiliate_user_id, '') = ba.id::text
                OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(ba.refer_code))
            )
        LEFT JOIN area_sales_manager asm ON acl.commission_source IN ('area_manager', 'asm_direct')
            AND (
                NULLIF(acl.affiliate_user_id, '') = asm.id::text
                OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(asm.refer_code))
            )
        LEFT JOIN affiliate_user u2 ON acl.commission_source = 'asm_direct' AND u2.refer_code = acl.affiliate_code
        LEFT JOIN state_admin sa_direct ON acl.commission_source = 'state_admin'
            AND LOWER(TRIM(acl.customer_email)) = LOWER(TRIM(sa_direct.email))
        WHERE ${whereClause}
        ORDER BY acl.created_at DESC
        LIMIT $${params.length + 1}
        `,
        [...params, limit],
    );

    return result.rows.map((row) => {
        const name = fullName(row.first_name, row.last_name);
        const saleLevel = saleLevelFromSource(row.commission_source);
        const amount = row.status === "CANCELLED" ? 0 : toAmount(row.amount);
        const isCancelled = row.status === "CANCELLED";

        return {
            id: `commission-${row.id}`,
            category: isCancelled ? "cancellation" : "commission",
            timestamp: row.created_at,
            actorName: name,
            action: isCancelled
                ? "order cancelled — commission voided"
                : `earned ${saleLevel.toLowerCase()} commission`,
            subtitle: row.product_name
                ? `${row.product_name} · #${row.order_id}`
                : `#${row.order_id}`,
            amount: isCancelled ? null : amount,
            saleLevel,
            territory: row.territory || row[territoryKey],
        };
    });
}

async function fetchAgentEvents(
    pool: Pool,
    whereClause: string,
    params: unknown[],
    limit = 20,
): Promise<ActivityEvent[]> {
    const result = await pool.query(
        `
        SELECT id, first_name, last_name, branch, city, state, is_approved, is_agent,
               rejected_at, created_at, updated_at
        FROM affiliate_user
        WHERE is_agent = true AND ${whereClause}
        ORDER BY GREATEST(created_at, COALESCE(updated_at, created_at), COALESCE(rejected_at, created_at)) DESC
        LIMIT $${params.length + 1}
        `,
        [...params, limit],
    );

    const events: ActivityEvent[] = [];

    for (const row of result.rows) {
        const name = fullName(row.first_name, row.last_name);
        const territory = row.branch || row.city || row.state || undefined;

        if (row.rejected_at) {
            events.push({
                id: `rejection-${row.id}`,
                category: "rejection",
                timestamp: row.rejected_at,
                actorName: name,
                action: "sales executive application rejected",
                territory,
            });
        } else if (row.is_approved && row.is_agent) {
            events.push({
                id: `approval-${row.id}`,
                category: "approval",
                timestamp: row.updated_at || row.created_at,
                actorName: name,
                action: "approved as sales executive",
                territory,
            });
        } else if (!row.is_approved) {
            events.push({
                id: `request-${row.id}`,
                category: "request",
                timestamp: row.created_at,
                actorName: name,
                action: "submitted partner signup request",
                territory,
            });
        }
    }

    return events;
}

async function fetchReturnEvents(
    pool: Pool,
    scopeJoin: string,
    params: unknown[],
    limit = 15,
): Promise<ActivityEvent[]> {
    try {
        const result = await pool.query(
            `
            SELECT DISTINCT ON (rr.id)
                rr.id,
                rr.order_id,
                rr.status,
                rr.created_at,
                acl.product_name,
                COALESCE(u.first_name, 'Customer') AS first_name,
                COALESCE(u.last_name, '') AS last_name,
                COALESCE(u.branch, ba.branch, s.branch_name) AS territory
            FROM return_request rr
            LEFT JOIN affiliate_commission_log acl ON acl.order_id = rr.order_id AND acl.commission_source = 'affiliate'
            LEFT JOIN affiliate_user u ON u.refer_code = acl.affiliate_code
            LEFT JOIN branch_admin ba ON ba.branch ILIKE u.branch
            LEFT JOIN stores s ON u.branch ILIKE s.branch_name
            WHERE rr.deleted_at IS NULL
              AND LOWER(COALESCE(rr.status, '')) NOT IN ('rejected','cancelled','canceled')
              AND ${scopeJoin}
            ORDER BY rr.id, rr.created_at DESC
            LIMIT $${params.length + 1}
            `,
            [...params, limit],
        );

        return result.rows.map((row) => ({
            id: `return-${row.id}`,
            category: "return" as const,
            timestamp: row.created_at,
            actorName: fullName(row.first_name, row.last_name, "Customer"),
            action: "return/refund requested on order",
            subtitle: row.product_name
                ? `${row.product_name} · #${row.order_id}`
                : `#${row.order_id}`,
            territory: row.territory,
        }));
    } catch {
        return [];
    }
}

async function fetchWithdrawalEvents(
    pool: Pool,
    branchFilter: string,
    params: unknown[],
    limit = 10,
): Promise<ActivityEvent[]> {
    try {
        const withdrawals = await pool.query(
            `
            SELECT wr.id, wr.amount, wr.status, wr.created_at, u.first_name, u.last_name
            FROM withdrawal_requests wr
            JOIN affiliate_user u ON wr.user_id = u.id
            WHERE ${branchFilter}
            ORDER BY wr.created_at DESC
            LIMIT $${params.length + 1}
            `,
            [...params, limit],
        );

        return withdrawals.rows.map((row) => ({
            id: `withdrawal-${row.id}`,
            category: "withdrawal" as const,
            timestamp: row.created_at,
            actorName: fullName(row.first_name, row.last_name),
            action: "requested withdrawal",
            amount: toAmount(row.amount),
        }));
    } catch {
        return [];
    }
}

async function fetchPaymentEvents(
    pool: Pool,
    branchFilter: string,
    params: unknown[],
    limit = 10,
): Promise<ActivityEvent[]> {
    try {
        const payments = await pool.query(
            `
            SELECT wr.id, wr.amount, wr.payment_date, wr.updated_at, u.first_name, u.last_name
            FROM withdrawal_requests wr
            JOIN affiliate_user u ON wr.user_id = u.id
            WHERE ${branchFilter} AND wr.status = 'PAID'
            ORDER BY COALESCE(wr.payment_date, wr.updated_at) DESC
            LIMIT $${params.length + 1}
            `,
            [...params, limit],
        );

        return payments.rows.map((row) => ({
            id: `payment-${row.id}`,
            category: "payment" as const,
            timestamp: row.payment_date || row.updated_at,
            actorName: fullName(row.first_name, row.last_name),
            action: "withdrawal paid to partner",
            amount: toAmount(row.amount),
        }));
    } catch {
        return [];
    }
}

async function fetchNotificationEvents(
    pool: Pool,
    recipientId: string,
    recipientRole: string,
    limit = 10,
): Promise<ActivityEvent[]> {
    try {
        const result = await pool.query(
            `
            SELECT id, message, type, created_at
            FROM notifications
            WHERE recipient_id = $1 AND recipient_role = $2
            ORDER BY created_at DESC
            LIMIT $3
            `,
            [recipientId, recipientRole, limit],
        );

        return result.rows.map((row) => ({
            id: `notification-${row.id}`,
            category: "notification" as const,
            timestamp: row.created_at,
            actorName: "System",
            action: String(row.message ?? "New notification"),
            subtitle: row.type ? String(row.type) : undefined,
        }));
    } catch {
        return [];
    }
}

async function fetchReferralEvents(
    pool: Pool,
    statePattern: string,
    limit = 15,
): Promise<ActivityEvent[]> {
    try {
        const result = await pool.query(
            `
            SELECT
                u.id, u.first_name, u.last_name, u.branch, u.created_at, u.referred_by,
                b.first_name AS b_first, b.last_name AS b_last,
                asm.first_name AS asm_first, asm.last_name AS asm_last,
                aff.first_name AS aff_first, aff.last_name AS aff_last
            FROM affiliate_user u
            LEFT JOIN branch_admin b ON u.referred_by = b.refer_code
            LEFT JOIN area_sales_manager asm ON u.referred_by = asm.refer_code
            LEFT JOIN affiliate_user aff ON u.referred_by = aff.refer_code
            WHERE u.state ILIKE $1
            ORDER BY u.created_at DESC
            LIMIT $2
            `,
            [statePattern, limit],
        );

        return result.rows.map((row) => {
            const name = fullName(row.first_name, row.last_name);
            let action = "joined the network";
            let actorName = name;

            if (row.b_first) {
                actorName = fullName(row.b_first, row.b_last);
                action = `referred ${name}`;
            } else if (row.asm_first) {
                actorName = fullName(row.asm_first, row.asm_last);
                action = `referred ${name}`;
            } else if (row.aff_first) {
                actorName = fullName(row.aff_first, row.aff_last);
                action = `referred ${name}`;
            } else if (!row.referred_by) {
                action = "joined directly";
            }

            return {
                id: `referral-${row.id}`,
                category: "referral" as const,
                timestamp: row.created_at,
                actorName,
                action,
                territory: row.branch,
            };
        });
    } catch {
        return [];
    }
}

async function fetchActivityLogEvents(
    pool: Pool,
    statePattern: string,
    limit = 15,
): Promise<ActivityEvent[]> {
    try {
        const result = await pool.query(
            `
            SELECT id, description, actor_name, actor_branch, amount, created_at
            FROM activity_log
            WHERE actor_state ILIKE $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [statePattern, limit],
        );

        return result.rows.map((row) => ({
            id: `activity-log-${row.id}`,
            category: "notification" as const,
            timestamp: row.created_at,
            actorName: row.actor_name || "System",
            action: String(row.description ?? "Activity logged"),
            amount: toAmount(row.amount) || null,
            territory: row.actor_branch,
        }));
    } catch {
        return [];
    }
}

export async function buildBranchAdminActivities(
    pool: Pool,
    options: { branch: string; adminId?: string },
    limit = 15,
): Promise<ActivityEvent[]> {
    const { branch, adminId } = options;
    const perSource = Math.ceil(limit / 2);

    const [
        seCommissions,
        agents,
        returns,
        withdrawals,
        payments,
        notifications,
    ] = await Promise.all([
        fetchCommissionEvents(
            pool,
            `(u.branch ILIKE $1 AND acl.commission_source = 'affiliate')`,
            [branch],
            "territory",
            perSource,
        ),
        fetchAgentEvents(pool, "branch ILIKE $1", [branch], perSource),
        fetchReturnEvents(pool, "u.branch ILIKE $1", [branch], 10),
        fetchWithdrawalEvents(pool, "u.branch ILIKE $1", [branch], 8),
        fetchPaymentEvents(pool, "u.branch ILIKE $1", [branch], 8),
        adminId
            ? fetchNotificationEvents(pool, adminId, "branch", 10)
            : Promise.resolve([]),
    ]);

    return sortAndLimit(
        [
            ...seCommissions,
            ...agents,
            ...returns,
            ...withdrawals,
            ...payments,
            ...notifications,
        ],
        limit,
    );
}

export async function buildBmActivities(
    pool: Pool,
    options: { city: string; state: string; adminId?: string },
    limit = 15,
): Promise<ActivityEvent[]> {
    const { city, state, adminId } = options;
    const cityPattern = city;
    const statePattern = state;

    const [
        seCommissions,
        asmCommissions,
        bmCommissions,
        agents,
        returns,
        notifications,
    ] = await Promise.all([
        fetchCommissionEvents(
            pool,
            `acl.commission_source = 'affiliate'
             AND EXISTS (
               SELECT 1 FROM affiliate_user u2
               JOIN stores s ON u2.branch ILIKE s.branch_name
               WHERE u2.refer_code = acl.affiliate_code
                 AND s.city ILIKE $1 AND s.state ILIKE $2
             )`,
            [cityPattern, statePattern],
            "territory",
            15,
        ),
        fetchCommissionEvents(
            pool,
            `acl.commission_source = 'branch_admin'
             AND EXISTS (
               SELECT 1 FROM branch_admin ba2
               WHERE ba2.city ILIKE $1 AND ba2.state ILIKE $2
                 AND (
                   NULLIF(acl.affiliate_user_id, '') = ba2.id::text
                   OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(ba2.refer_code))
                 )
             )`,
            [cityPattern, statePattern],
            "territory",
            15,
        ),
        adminId
            ? fetchCommissionEvents(
                  pool,
                  `acl.commission_source = 'area_manager' AND NULLIF(acl.affiliate_user_id, '') = $1::text`,
                  [adminId],
                  "territory",
                  10,
              )
            : Promise.resolve([]),
        fetchAgentEvents(
            pool,
            `city ILIKE $1 AND state ILIKE $2`,
            [cityPattern, statePattern],
            15,
        ),
        fetchReturnEvents(
            pool,
            `s.city ILIKE $1 AND s.state ILIKE $2`,
            [cityPattern, statePattern],
            10,
        ),
        adminId
            ? fetchNotificationEvents(pool, adminId, "asm", 10)
            : Promise.resolve([]),
    ]);

    return sortAndLimit(
        [
            ...seCommissions,
            ...asmCommissions,
            ...bmCommissions,
            ...agents,
            ...returns,
            ...notifications,
        ],
        limit,
    );
}

export async function buildStateAdminActivities(
    pool: Pool,
    options: { state: string; adminId?: string },
    limit = 15,
): Promise<ActivityEvent[]> {
    const cleanState = options.state.replace(/\s+State$/i, "").trim();
    const statePattern = `%${cleanState}%`;

    const [
        seCommissions,
        asmCommissions,
        bmCommissions,
        stateCommissions,
        agents,
        returns,
        referrals,
        activityLog,
        notifications,
    ] = await Promise.all([
        fetchCommissionEvents(
            pool,
            `acl.commission_source = 'affiliate'
             AND EXISTS (
               SELECT 1 FROM affiliate_user u2
               JOIN stores s ON u2.branch ILIKE s.branch_name
               WHERE u2.refer_code = acl.affiliate_code AND s.state ILIKE $1
             )`,
            [statePattern],
            "territory",
            15,
        ),
        fetchCommissionEvents(
            pool,
            `acl.commission_source = 'branch_admin'
             AND EXISTS (SELECT 1 FROM branch_admin ba2 WHERE ba2.state ILIKE $1
               AND (NULLIF(acl.affiliate_user_id, '') = ba2.id::text
                    OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(ba2.refer_code))))`,
            [statePattern],
            "territory",
            15,
        ),
        fetchCommissionEvents(
            pool,
            `acl.commission_source IN ('area_manager', 'asm_direct')
             AND EXISTS (
               SELECT 1 FROM area_sales_manager asm2
               WHERE asm2.state ILIKE $1
                 AND (
                   NULLIF(acl.affiliate_user_id, '') = asm2.id::text
                   OR LOWER(TRIM(acl.affiliate_code)) = LOWER(TRIM(asm2.refer_code))
                 )
             )`,
            [statePattern],
            "territory",
            15,
        ),
        fetchCommissionEvents(
            pool,
            `acl.commission_source = 'state_admin'
             AND EXISTS (SELECT 1 FROM state_admin sa WHERE sa.state ILIKE $1
               AND LOWER(TRIM(acl.customer_email)) = LOWER(TRIM(sa.email)))`,
            [statePattern],
            "territory",
            10,
        ),
        fetchAgentEvents(pool, "state ILIKE $1", [statePattern], 15),
        fetchReturnEvents(
            pool,
            `s.state ILIKE $1`,
            [statePattern],
            10,
        ),
        fetchReferralEvents(pool, statePattern, 15),
        fetchActivityLogEvents(pool, statePattern, 10),
        options.adminId
            ? fetchNotificationEvents(pool, options.adminId, "state", 10)
            : Promise.resolve([]),
    ]);

    return sortAndLimit(
        [
            ...seCommissions,
            ...asmCommissions,
            ...bmCommissions,
            ...stateCommissions,
            ...agents,
            ...returns,
            ...referrals,
            ...activityLog,
            ...notifications,
        ],
        limit,
    );
}

export async function buildNationalActivities(
    pool: Pool,
    limit = 15,
): Promise<ActivityEvent[]> {
    const [
        commissions,
        agents,
        returns,
        referrals,
    ] = await Promise.all([
        fetchCommissionEvents(pool, "1=1", [], "territory", 25),
        fetchAgentEvents(pool, "1=1", [], 20),
        fetchReturnEvents(pool, "1=1", [], 15),
        fetchReferralEvents(pool, "%", 15),
    ]);

    return sortAndLimit(
        [...commissions, ...agents, ...returns, ...referrals],
        limit,
    );
}
