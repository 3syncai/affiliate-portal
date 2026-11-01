import type { Pool } from "pg";

type Queryable = Pick<Pool, "query">;

/** Run only on the settlement transaction's dedicated connection. */
export async function creditDueCommissions(db: Queryable, returnHoldSql: string, affiliateCode?: string) {
    const result = await db.query(`
        SELECT acl.id::text AS id, COALESCE(acl.affiliate_commission, 0)::text AS amount,
            CASE WHEN acl.commission_source = 'affiliate' THEN
                (SELECT au.id::text FROM affiliate_user au WHERE au.refer_code = acl.affiliate_code)
            WHEN acl.commission_source IN ('branch_admin', 'area_manager', 'asm_direct',
                'state_admin', 'state_admin_direct') THEN NULLIF(trim(acl.affiliate_user_id::text), '')
            END AS customer_id
        FROM affiliate_commission_log acl
        WHERE acl.status = 'PENDING' AND acl.unlock_at <= NOW()
            AND ($1::text IS NULL OR acl.affiliate_code = $1)
            AND COALESCE(acl.affiliate_commission, 0) >= 0
            AND NOT (${returnHoldSql})
            AND ((acl.commission_source = 'affiliate' AND EXISTS (
                SELECT 1 FROM affiliate_user au WHERE au.refer_code = acl.affiliate_code))
              OR (acl.commission_source IN ('branch_admin', 'area_manager', 'asm_direct',
                'state_admin', 'state_admin_direct') AND NULLIF(trim(acl.affiliate_user_id::text), '') IS NOT NULL))
        ORDER BY acl.unlock_at, acl.id
        LIMIT 100 FOR UPDATE OF acl SKIP LOCKED
    `, [affiliateCode || null]);
    let credited = 0;
    for (const row of result.rows) {
        const receipt = await db.query(`
            INSERT INTO partner_commission_wallet_ledger (commission_id, customer_id, amount)
            VALUES ($1, $2, $3::numeric) ON CONFLICT (commission_id) DO NOTHING
            RETURNING commission_id
        `, [row.id, row.customer_id, row.amount]);
        // Admin's existing zero-rate correction can turn a zero-money receipt into
        // its first payable amount. Never top up or replay a nonzero receipt.
        const zeroCorrection = !receipt.rowCount ? await db.query(`
            UPDATE partner_commission_wallet_ledger SET amount = $3::numeric, legacy_baseline = false
            WHERE commission_id = $1 AND customer_id = $2 AND amount = 0 AND reversed_at IS NULL
            RETURNING commission_id
        `, [row.id, row.customer_id, row.amount]) : null;
        if (receipt.rowCount || zeroCorrection?.rowCount) {
            await db.query(`
                INSERT INTO customer_wallet (customer_id, coins_balance) VALUES ($1, $2::numeric)
                ON CONFLICT (customer_id) DO UPDATE
                SET coins_balance = COALESCE(customer_wallet.coins_balance, 0) + EXCLUDED.coins_balance
            `, [row.customer_id, row.amount]);
        } else {
            const previous = await db.query(`
                SELECT 1 FROM partner_commission_wallet_ledger WHERE commission_id = $1
                  AND customer_id = $2 AND amount = $3::numeric AND reversed_at IS NULL
            `, [row.id, row.customer_id, row.amount]);
            if (!previous.rowCount) throw new Error(`Settlement receipt mismatch for commission ${row.id}`);
        }
        const promoted = await db.query(`
            UPDATE affiliate_commission_log SET status = 'CREDITED', credited_at = COALESCE(credited_at, NOW())
            WHERE id::text = $1 AND status = 'PENDING' RETURNING status
        `, [row.id]);
        if (promoted.rows[0]?.status !== "CREDITED") throw new Error(`Promotion rejected for commission ${row.id}`);
        credited++;
    }
    return credited;
}

/** Reverse only an actual credit receipt; never subtract an uncredited pending amount. */
export async function cancelCommissionRows(db: Queryable, ids: string[]) {
    if (!ids.length) return 0;
    const locked = await db.query(`SELECT id::text AS id FROM affiliate_commission_log
        WHERE id::text = ANY($1::text[]) AND (status IS DISTINCT FROM 'CANCELLED' OR EXISTS (
            SELECT 1 FROM partner_commission_wallet_ledger wl
            WHERE wl.commission_id = id::text AND wl.reversed_at IS NULL))
        ORDER BY id FOR UPDATE`, [ids]);
    for (const row of locked.rows) {
        const receipt = await db.query(`UPDATE partner_commission_wallet_ledger
            SET reversed_at = NOW() WHERE commission_id = $1 AND reversed_at IS NULL
            RETURNING customer_id, amount::text`, [row.id]);
        if (receipt.rowCount) {
            const entry = receipt.rows[0];
            if (Number(entry.amount) > 0) {
                if (!entry.customer_id) throw new Error(`Missing legacy recipient for commission ${row.id}`);
                // Preserve the existing zero-floor wallet reversal policy.
                const reversed = await db.query(`UPDATE customer_wallet SET coins_balance = GREATEST(0, coins_balance - $2::numeric)
                WHERE customer_id = $1`, [entry.customer_id, entry.amount]);
                if (!reversed.rowCount) throw new Error(`Missing wallet for commission ${row.id}`);
            }
        }
        await db.query(`UPDATE affiliate_commission_log SET status = 'CANCELLED', affiliate_commission = 0,
            additional_commission_amount = 0, credited_at = NULL, unlock_at = NULL WHERE id::text = $1`, [row.id]);
    }
    return locked.rows.length;
}
