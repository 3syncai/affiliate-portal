-- Migration: Add is_active column to affiliate_user
-- Allows the National Head (admin) to block / unblock sales-executive (agent) logins
-- Existing rows default to TRUE so previously-registered users remain active.

ALTER TABLE affiliate_user
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill any NULL values that may exist if the column was created without the default in older environments.
UPDATE affiliate_user SET is_active = TRUE WHERE is_active IS NULL;

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'affiliate_user' AND column_name = 'is_active';
