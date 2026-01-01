-- Add affiliate role to commission_rates table
-- This allows admin to set the percentage that affiliate agents receive from their commission
-- The remaining percentage will be distributed to branch/area/state admins

INSERT INTO commission_rates (role_type, commission_percentage, description) 
VALUES ('affiliate', 70.00, 'Commission percentage that affiliate agents receive from their product commission')
ON CONFLICT (role_type) DO NOTHING;
