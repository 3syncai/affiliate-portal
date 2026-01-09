-- Add customer name and email columns to store actual customer details
-- This allows displaying customer information instead of just IDs

-- Add columns to affiliate_commission_log
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add columns to affiliate_referrals  
ALTER TABLE affiliate_referrals
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commission_log_customer_email ON affiliate_commission_log(customer_email);
CREATE INDEX IF NOT EXISTS idx_referrals_customer_email ON affiliate_referrals(customer_email);
