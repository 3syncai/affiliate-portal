-- Migration: Add commission split columns to affiliate_commission_log
-- This stores the actual amounts given to affiliate (70%) and platform (30%)

-- Add affiliate_amount column (70% of commission that goes to affiliate)
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS affiliate_amount DECIMAL(12,2);

-- Add platform_amount column (30% of commission that stays with platform)
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS platform_amount DECIMAL(12,2);

-- Update existing records to calculate split amounts
-- affiliate_amount = commission_amount * 0.70
-- platform_amount = commission_amount * 0.30
UPDATE affiliate_commission_log 
SET 
    affiliate_amount = ROUND(commission_amount * 0.70, 2),
    platform_amount = ROUND(commission_amount * 0.30, 2)
WHERE affiliate_amount IS NULL OR platform_amount IS NULL;

-- Verify the update
SELECT 
    id,
    order_id,
    commission_amount AS total_commission,
    affiliate_amount AS "affiliate_70%",
    platform_amount AS "platform_30%"
FROM affiliate_commission_log
ORDER BY created_at DESC
LIMIT 10;
