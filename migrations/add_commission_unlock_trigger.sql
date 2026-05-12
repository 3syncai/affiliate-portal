-- Migration: Enforce the 5-minute post-delivery delay before a commission
-- becomes CREDITED, no matter which application code path performs the write.
--
-- Background: There are several writers to affiliate_commission_log
-- (Medusa subscriber, /api/webhook/commission/update-status, the per-item
-- /api/webhook/commission, the storefront /api/webhooks/order-delivered,
-- and the affiliate-portal sync). Each used to flip status straight to
-- 'CREDITED' on delivery, which made the live countdown badge in the UI
-- impossible to render. Centralising the rule in a database trigger means we
-- don't have to keep every writer in lock-step.
--
-- Behaviour:
--   * If a write tries to set status='CREDITED' but the unlock window has not
--     elapsed (unlock_at is NULL or in the future), the trigger rewrites the
--     row to status='PENDING' with unlock_at = NOW() + 5 minutes (kept if
--     already set). credited_at is cleared.
--   * If unlock_at <= NOW() (i.e. the affiliate-portal sync's promotion step
--     is the one writing), the CREDITED status is allowed through.
--   * Rows that were already CREDITED before this migration are NOT
--     re-deferred (we early-return for OLD.status = 'CREDITED' on UPDATE).
--   * PENDING and CANCELLED writes are passed through unchanged.

CREATE OR REPLACE FUNCTION enforce_commission_unlock_delay()
RETURNS TRIGGER AS $$
BEGIN
    -- Don't re-defer rows that were already CREDITED (legacy data, manual
    -- back-office fixes, etc).
    IF (TG_OP = 'UPDATE' AND OLD.status = 'CREDITED') THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'CREDITED' THEN
        IF NEW.unlock_at IS NULL THEN
            NEW.unlock_at := NOW() + INTERVAL '5 minutes';
            NEW.status := 'PENDING';
            NEW.credited_at := NULL;
        ELSIF NEW.unlock_at > NOW() THEN
            NEW.status := 'PENDING';
            NEW.credited_at := NULL;
        END IF;
        -- If unlock_at <= NOW(), the sync's promotion path is doing the
        -- update; allow status='CREDITED' to stick.
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_commission_unlock_delay_trigger
    ON affiliate_commission_log;

CREATE TRIGGER enforce_commission_unlock_delay_trigger
    BEFORE INSERT OR UPDATE ON affiliate_commission_log
    FOR EACH ROW
    EXECUTE FUNCTION enforce_commission_unlock_delay();
