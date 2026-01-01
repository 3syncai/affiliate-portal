-- Activity log table for tracking all admin activities across the system
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL, -- 'payment_approved', 'payment_paid', 'affiliate_approved', etc.
    actor_id TEXT NOT NULL,  -- ID of the admin who performed the action
    actor_name VARCHAR(255),  -- Name of the admin
    actor_role VARCHAR(50) NOT NULL,  -- 'branch', 'asm', 'state', 'admin'
    actor_branch VARCHAR(255),  -- Branch name if applicable
    actor_state VARCHAR(255),  -- State name if applicable
    target_id TEXT,  -- ID of the affected entity (affiliate_id, withdrawal_id, etc.)
    target_name VARCHAR(255),  -- Name of the affected entity
    target_type VARCHAR(50),  -- 'affiliate', 'withdrawal', 'order', etc.
    amount DECIMAL(12,2),  -- Amount involved if applicable
    description TEXT,  -- Human-readable description of the activity
    metadata JSONB,  -- Additional data in JSON format
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by role and time
CREATE INDEX IF NOT EXISTS idx_activity_role ON activity_log(actor_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_state ON activity_log(actor_state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_branch ON activity_log(actor_branch, created_at DESC);

-- Example activities that will be logged:
-- 1. Branch admin approves withdrawal: "Nalasopara branch approved ₹20.00 withdrawal for nala sola"
-- 2. Branch admin marks payment as paid: "Nalasopara branch paid ₹16.40 to nala sola (Txn: XYZ123)"
-- 3. Branch admin approves affiliate: "Nalasopara branch approved nala sola as affiliate"
