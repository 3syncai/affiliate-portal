-- Create stores table if it doesn't exist
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    address TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stores_state ON stores(state);
CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_branch_name ON stores(branch_name);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS stores_updated_at_trigger ON stores;
CREATE TRIGGER stores_updated_at_trigger
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_stores_updated_at();
