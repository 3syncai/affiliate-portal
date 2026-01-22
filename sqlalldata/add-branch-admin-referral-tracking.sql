-- Migration: Add Branch Admin Referral Tracking
-- This enables branch admins to receive enhanced commission (75%) when they directly refer customers

-- Add columns to track branch admin referrals
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS is_branch_admin_referral BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS branch_admin_bonus DECIMAL(10,2) DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_branch_admin_referral 
ON affiliate_commission_log(is_branch_admin_referral);

-- Add comments for documentation
COMMENT ON COLUMN affiliate_commission_log.is_branch_admin_referral IS 'TRUE when referral code belongs to a branch admin (gets 75% instead of 70%)';
COMMENT ON COLUMN affiliate_commission_log.branch_admin_bonus IS 'Additional 5% bonus for branch admin direct referrals (on top of 70% base)';
