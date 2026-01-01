-- Add transaction tracking fields to withdrawal_request table
ALTER TABLE withdrawal_request 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_details TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Update existing comment on status column
COMMENT ON COLUMN withdrawal_request.status IS 'PENDING, APPROVED, REJECTED, PAID';
