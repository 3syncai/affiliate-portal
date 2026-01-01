-- Area Sales Manager table to store area sales managers created by state admins
CREATE TABLE IF NOT EXISTS area_sales_manager (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,  -- Inherited from state admin who created them
    created_by UUID NOT NULL,      -- ID of state admin who created this ASM
    role VARCHAR(50) DEFAULT 'asm' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES state_admin(id)
);

-- Create indexes for faster queries
CREATE INDEX idx_asm_email ON area_sales_manager(email);
CREATE INDEX idx_asm_state ON area_sales_manager(state);
CREATE INDEX idx_asm_city ON area_sales_manager(city);
CREATE INDEX idx_asm_created_by ON area_sales_manager(created_by);
