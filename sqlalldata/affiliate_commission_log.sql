-- Affiliate Commission Log table to track all commission transactions
CREATE TABLE IF NOT EXISTS affiliate_commission_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) UNIQUE NOT NULL,
    affiliate_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    item_price DECIMAL(10, 2),
    order_amount DECIMAL(10, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL,  -- Overall commission rate (e.g., 5%)
    commission_amount DECIMAL(10, 2) NOT NULL,  -- Total commission for the order
    affiliate_rate DECIMAL(5, 2) DEFAULT 70.00,  -- Percentage affiliate receives (e.g., 70%)
    affiliate_commission DECIMAL(10, 2) NOT NULL,  -- Actual amount affiliate receives
    is_branch_admin_referral BOOLEAN DEFAULT FALSE,  -- Flag for branch admin direct referrals
    branch_admin_bonus DECIMAL(10, 2) DEFAULT 0.00,  -- 5% bonus for branch admin referrals
    commission_source VARCHAR(50) DEFAULT 'order',  -- 'order', 'registration', etc.
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, CREDITED, PAID
    customer_id VARCHAR(255),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_commission_log_order_id ON affiliate_commission_log(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_log_affiliate_code ON affiliate_commission_log(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_commission_log_status ON affiliate_commission_log(status);
CREATE INDEX IF NOT EXISTS idx_commission_log_customer_id ON affiliate_commission_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_commission_log_created_at ON affiliate_commission_log(created_at);
CREATE INDEX IF NOT EXISTS idx_branch_admin_referral ON affiliate_commission_log(is_branch_admin_referral);

-- Add comment for documentation
COMMENT ON COLUMN affiliate_commission_log.is_branch_admin_referral IS 'Indicates if this commission is from a Branch Admin directly referring a customer (earns 75% instead of 70%)';
COMMENT ON COLUMN affiliate_commission_log.branch_admin_bonus IS 'Additional 5% bonus for Branch Admin direct referrals (on top of base 70%)';
