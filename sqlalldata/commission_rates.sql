-- Commission Rates table to store commission percentages for different admin roles
CREATE TABLE IF NOT EXISTS commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type VARCHAR(50) UNIQUE NOT NULL,
    commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default commission rates
INSERT INTO commission_rates (role_type, commission_percentage, description) VALUES
    ('branch', 5.00, 'Commission rate for Branch Admins'),
    ('area', 3.00, 'Commission rate for Area Sales Managers'),
    ('state', 2.00, 'Commission rate for State Admins')
ON CONFLICT (role_type) DO NOTHING;

-- Create index for faster queries
CREATE INDEX idx_commission_rates_role_type ON commission_rates(role_type);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commission_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before any update
CREATE TRIGGER commission_rates_updated_at_trigger
    BEFORE UPDATE ON commission_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_rates_updated_at();