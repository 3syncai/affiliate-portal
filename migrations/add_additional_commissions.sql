-- Additional commission campaigns (product + role + time window)
CREATE TABLE IF NOT EXISTS additional_commissions (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT,
  additional_rate DECIMAL(10,2) NOT NULL CHECK (additional_rate >= 0),
  target_role TEXT NOT NULL CHECK (target_role IN ('partner','asm','branch','state','all')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_additional_commission_product_active
ON additional_commissions(product_id, target_role, is_active, starts_at, ends_at);

ALTER TABLE affiliate_commission_log
ADD COLUMN IF NOT EXISTS additional_commission_id BIGINT,
ADD COLUMN IF NOT EXISTS additional_commission_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS additional_commission_amount DECIMAL(12,2) DEFAULT 0;
