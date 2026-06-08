-- Add phone number to main admin (National Head) accounts
ALTER TABLE affiliate_admin
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

COMMENT ON COLUMN affiliate_admin.phone IS 'Mobile number for the main administrator (National Head)';
