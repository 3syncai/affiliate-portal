-- Branch Admin Referral Tracking System
-- This migration creates the necessary tables for tracking branch admin referrals and commissions

-- Create branch_admin_referrals table
CREATE TABLE IF NOT EXISTS branch_admin_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_admin_code VARCHAR(50) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    total_orders INTEGER DEFAULT 0,
    total_order_value DECIMAL(10,2) DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    first_order_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(branch_admin_code, customer_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_admin_referrals_code ON branch_admin_referrals(branch_admin_code);
CREATE INDEX IF NOT EXISTS idx_branch_admin_referrals_customer ON branch_admin_referrals(customer_id);
CREATE INDEX IF NOT EXISTS idx_branch_admin_referrals_created ON branch_admin_referrals(created_at DESC);

-- Add branch_admin_code column to affiliate_commission_log
ALTER TABLE affiliate_commission_log 
ADD COLUMN IF NOT EXISTS branch_admin_code VARCHAR(50);

-- Add index on branch_admin_code
CREATE INDEX IF NOT EXISTS idx_commission_log_branch_admin ON affiliate_commission_log(branch_admin_code);

-- Add helpful comments
COMMENT ON TABLE branch_admin_referrals IS 'Tracks customers referred by branch admins';
COMMENT ON COLUMN branch_admin_referrals.branch_admin_code IS 'The refer_code of the branch admin who referred this customer';
COMMENT ON COLUMN affiliate_commission_log.branch_admin_code IS 'Set when commission is from a branch admin direct referral';

SELECT 'Branch admin referral tracking tables created successfully' as status;
