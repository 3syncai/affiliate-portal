-- Migration: Add commission rate for branch admin direct referrals
-- This defines the additional percentage branch admins receive for their direct referrals
-- Total commission for branch admin = affiliate_rate (70%) + branch_direct_rate (15%) = 85%

-- Insert/Update commission rate for branch admin direct referrals
INSERT INTO commission_rates (role_type, commission_percentage, description) 
VALUES (
    'branch_direct', 
    15.00, 
    'Additional commission percentage for branch admins on their direct referrals (added to affiliate base rate of 70%)'
)
ON CONFLICT (role_type) DO UPDATE 
SET 
    commission_percentage = 15.00,
    description = 'Additional commission percentage for branch admins on their direct referrals (added to affiliate base rate of 70%)',
    updated_at = CURRENT_TIMESTAMP;

-- Verify current commission rates
SELECT 
    role_type,
    commission_percentage,
    description,
    created_at,
    updated_at
FROM commission_rates 
WHERE role_type IN ('affiliate', 'branch', 'branch_direct', 'area', 'state')
ORDER BY 
    CASE role_type
        WHEN 'affiliate' THEN 1
        WHEN 'branch_direct' THEN 2
        WHEN 'branch' THEN 3
        WHEN 'area' THEN 4
        WHEN 'state' THEN 5
    END;

-- Show example calculation
SELECT 
    'Example: ₹100 product commission' as scenario,
    '₹70 (70%)' as affiliate_gets,
    '₹85 (70% + 15%)' as branch_admin_gets,
    '₹30 or ₹15' as platform_keeps;
