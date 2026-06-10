ALTER TABLE stores ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);

CREATE INDEX IF NOT EXISTS idx_stores_pincode ON stores(pincode);
