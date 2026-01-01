-- State Admin table to store state branch administrators
CREATE TABLE IF NOT EXISTS state_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    state VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'state' NOT NULL,  -- Role is always 'state' for state admins
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_state_admin_email ON state_admin(email);
CREATE INDEX idx_state_admin_state ON state_admin(state);
