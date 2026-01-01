-- Branch Admin table to store branch administrators created by ASMs
CREATE TABLE IF NOT EXISTS branch_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL,  -- ID of ASM who created this branch admin
    role VARCHAR(50) DEFAULT 'branch' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch_created_by FOREIGN KEY (created_by) REFERENCES area_sales_manager(id)
);

-- Create indexes for faster queries
CREATE INDEX idx_branch_admin_email ON branch_admin(email);
CREATE INDEX idx_branch_admin_branch ON branch_admin(branch);
CREATE INDEX idx_branch_admin_city ON branch_admin(city);
CREATE INDEX idx_branch_admin_created_by ON branch_admin(created_by);
