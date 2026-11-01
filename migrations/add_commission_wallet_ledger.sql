-- Run with old portal/settlement writers stopped. No historical wallet balance is changed.
BEGIN;
SELECT pg_advisory_xact_lock(726394281);
LOCK TABLE affiliate_commission_log IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS partner_commission_wallet_ledger (
    commission_id text PRIMARY KEY,
    customer_id text,
    amount numeric NOT NULL CHECK (amount >= 0),
    legacy_baseline boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    reversed_at timestamptz
);
-- Historical CREDITED does not prove that its old wallet write succeeded.
-- Baseline prevents replay; reconcile ambiguous historical balances separately.
INSERT INTO partner_commission_wallet_ledger (commission_id, customer_id, amount, legacy_baseline)
SELECT acl.id::text,
    CASE WHEN acl.commission_source = 'affiliate' THEN
        (SELECT au.id::text FROM affiliate_user au WHERE au.refer_code = acl.affiliate_code)
    WHEN acl.commission_source IN ('branch_admin', 'area_manager', 'asm_direct', 'state_admin', 'state_admin_direct')
        THEN NULLIF(trim(acl.affiliate_user_id::text), '') END,
    GREATEST(0, COALESCE(acl.affiliate_commission, 0)), true
FROM affiliate_commission_log acl WHERE acl.status = 'CREDITED'
ON CONFLICT (commission_id) DO NOTHING;
CREATE INDEX IF NOT EXISTS affiliate_commission_pending_unlock_idx
    ON affiliate_commission_log (unlock_at, id) WHERE status = 'PENDING';
CREATE TABLE IF NOT EXISTS partner_commission_settlement_worker (
    worker_name text PRIMARY KEY,
    last_success_at timestamptz,
    last_error_at timestamptz,
    last_error text,
    duration_ms bigint
);
COMMIT;
