-- Migration script to add refer_code column to existing branch_admin table
-- Run this after updating the schema

-- Add refer_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'branch_admin' AND column_name = 'refer_code'
    ) THEN
        ALTER TABLE branch_admin ADD COLUMN refer_code VARCHAR(50) UNIQUE;
        
        -- Create index for refer_code
        CREATE INDEX IF NOT EXISTS idx_branch_admin_refer_code ON branch_admin(refer_code);
        
        RAISE NOTICE 'Column refer_code added successfully to branch_admin table';
    ELSE
        RAISE NOTICE 'Column refer_code already exists in branch_admin table';
    END IF;
END $$;
