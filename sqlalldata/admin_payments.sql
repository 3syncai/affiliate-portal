-- Admin Payments Table
-- Stores payment transactions from main admin to branch/asm/state admins

CREATE TABLE IF NOT EXISTS admin_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient Information
    recipient_id UUID NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('branch', 'asm', 'state')),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    
    -- Payment Details
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    transaction_id VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
    
    -- Account Details (JSON storing bank/UPI info)
    account_details JSONB,
    
    -- Payment Metadata
    paid_by VARCHAR(255) NOT NULL DEFAULT 'Admin',
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_admin_payments_recipient ON admin_payments(recipient_id, recipient_type);
CREATE INDEX idx_admin_payments_date ON admin_payments(payment_date DESC);
CREATE INDEX idx_admin_payments_transaction ON admin_payments(transaction_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_admin_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_payments_updated_at
    BEFORE UPDATE ON admin_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_payments_updated_at();

-- Comments for documentation
COMMENT ON TABLE admin_payments IS 'Stores payment transactions from main admin to sub-admins';
COMMENT ON COLUMN admin_payments.recipient_type IS 'Type of admin receiving payment: branch, asm, or state';
COMMENT ON COLUMN admin_payments.account_details IS 'JSON object storing bank account or UPI details';
COMMENT ON COLUMN admin_payments.transaction_id IS 'Bank/UPI transaction reference number';
