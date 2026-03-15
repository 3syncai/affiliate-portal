-- Enhance activity_log table to support hierarchical notifications
-- Adds area/city tracking and product details for commission tracking

-- Add new columns for area and product tracking
ALTER TABLE activity_log 
ADD COLUMN IF NOT EXISTS actor_area VARCHAR(255),  -- City of the ASM (area)
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS product_id TEXT;

-- Add index for area-based queries (ASM level)
CREATE INDEX IF NOT EXISTS idx_activity_area ON activity_log(actor_area, created_at DESC);

-- Add composite indexes for better filtering
CREATE INDEX IF NOT EXISTS idx_activity_state_area ON activity_log(actor_state, actor_area, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_full_hierarchy ON activity_log(actor_state, actor_area, actor_branch, created_at DESC);

-- Example records with hierarchical context:
-- Branch level: "Affiliate Rahul earned ₹50 commission on Product X"
-- Area (ASM) level: "In Nalasopara branch, affiliate Rahul earned ₹50 commission on Product X"
-- State level: "In Mumbai area, Nalasopara branch, affiliate Rahul earned ₹50 commission on Product X"
-- Main level: "In Maharashtra state, Mumbai area, Nalasopara branch, affiliate Rahul earned ₹50 commission on Product X"

COMMENT ON COLUMN activity_log.actor_area IS 'City/Area of the ASM (Area Sales Manager) - used for ASM-level filtering';
COMMENT ON COLUMN activity_log.product_name IS 'Product name for commission activities';
COMMENT ON COLUMN activity_log.product_id IS 'Product ID for commission activities';
