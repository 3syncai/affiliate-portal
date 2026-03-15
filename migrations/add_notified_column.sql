-- Add notified column to track which notifications have been sent
ALTER TABLE withdrawal_request 
ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT false;

-- Index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_notified 
ON withdrawal_request(affiliate_code, status, notified) 
WHERE status = 'PAID';
