-- Migration: Create admin_users table and add theme columns
-- Run this SQL in your database

-- Create admin_users table for storing local admin settings
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(255),
    theme VARCHAR(20) DEFAULT 'violet',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add theme column to other user tables (if not exists)
ALTER TABLE area_sales_manager ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'blue';
ALTER TABLE state_admin ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'emerald';
ALTER TABLE branch_admin ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'amber';
ALTER TABLE affiliate_user ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'blue';

-- Verify all tables have theme column
SELECT 'admin_users' as table_name, column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'admin_users' AND column_name = 'theme'
UNION ALL
SELECT 'area_sales_manager', column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'area_sales_manager' AND column_name = 'theme'
UNION ALL
SELECT 'state_admin', column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'state_admin' AND column_name = 'theme'
UNION ALL
SELECT 'branch_admin', column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'branch_admin' AND column_name = 'theme'
UNION ALL
SELECT 'affiliate_user', column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'affiliate_user' AND column_name = 'theme';
