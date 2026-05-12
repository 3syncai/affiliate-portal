-- Migration: Add unlock_at column to affiliate_commission_log
-- Used for the post-delivery 5-minute countdown before a commission becomes
-- spendable in the affiliate's wallet. The sync sets unlock_at when delivery
-- is detected, and promotes status to 'CREDITED' once unlock_at <= NOW().

ALTER TABLE affiliate_commission_log
    ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_commission_log_unlock_at
    ON affiliate_commission_log(unlock_at)
    WHERE unlock_at IS NOT NULL;

COMMENT ON COLUMN affiliate_commission_log.unlock_at IS
    'Timestamp at which a delivered commission becomes CREDITED (5 minutes after delivery). NULL when the order is not yet delivered.';
