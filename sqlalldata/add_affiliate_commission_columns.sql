-- Migration: Add affiliate commission columns to affiliate_commission_log
-- This stores the affiliate's actual earnings separate from full commission

-- Add columns for affiliate rate and their actual commission
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS affiliate_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS affiliate_commission DECIMAL(10,2);

-- Update existing records: Set affiliate_commission = commission_amount for old records
-- (assuming 100% rate before this feature was implemented)
UPDATE affiliate_commission_log 
SET affiliate_rate = 100.00,
    affiliate_commission = commission_amount
WHERE affiliate_commission IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN affiliate_commission_log.affiliate_rate IS 'Commission percentage rate for affiliate at time of order (e.g., 70.00 for 70%)';
COMMENT ON COLUMN affiliate_commission_log.affiliate_commission IS 'Actual commission amount affiliate receives after platform fee deduction';
