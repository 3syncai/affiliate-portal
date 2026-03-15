CREATE TABLE IF NOT EXISTS withdrawal_request (
  id SERIAL PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  affiliate_code VARCHAR(255) NOT NULL,
  affiliate_name VARCHAR(255) NOT NULL,
  affiliate_email VARCHAR(255) NOT NULL,
  
  -- Withdrawal details
  withdrawal_amount DECIMAL(10, 2) NOT NULL,
  gst_percentage DECIMAL(5, 2) NOT NULL,
  gst_amount DECIMAL(10, 2) NOT NULL,
  net_payable DECIMAL(10, 2) NOT NULL,
  
  -- Payment method details
  payment_method VARCHAR(50) NOT NULL, -- 'Bank Transfer' or 'UPI'
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  ifsc_code VARCHAR(50),
  account_name VARCHAR(255),
  account_number VARCHAR(100),
  upi_id VARCHAR(255),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, PAID
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  admin_notes TEXT,
  
  -- Wallet snapshot for audit
  wallet_balance_before DECIMAL(10, 2),
  
  CONSTRAINT fk_affiliate FOREIGN KEY (affiliate_id) REFERENCES affiliate_user(id)
);

-- Add index for faster queries
CREATE INDEX idx_withdrawal_status ON withdrawal_request(status);
CREATE INDEX idx_withdrawal_affiliate ON withdrawal_request(affiliate_id);
