-- Migration: Add referral code to branch_admin table
-- This enables branch admins to have their own referral codes like affiliates

-- Add referral code column to branch_admin table
ALTER TABLE branch_admin 
ADD COLUMN IF NOT EXISTS refer_code VARCHAR(50);

-- Create unique constraint and index
CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_admin_refer_code 
ON branch_admin(refer_code) WHERE refer_code IS NOT NULL;

-- Generate referral codes for existing branch admins
-- Format: OWEGBR{FIRSTNAME}{5-digits}
UPDATE branch_admin
SET refer_code = 'OWEGBR' || UPPER(SUBSTRING(first_name FROM 1 FOR 6)) || LPAD(FLOOR(10000 + RANDOM() * 90000)::TEXT, 5, '0')
WHERE refer_code IS NULL;

-- Make refer_code NOT NULL after populating existing records
ALTER TABLE branch_admin 
ALTER COLUMN refer_code SET NOT NULL;

-- Add unique constraint now that all rows have values
ALTER TABLE branch_admin 
ADD CONSTRAINT branch_admin_refer_code_key UNIQUE (refer_code);

-- Verify the migration
SELECT id, first_name, last_name, refer_code, branch 
FROM branch_admin 
ORDER BY created_at DESC 
LIMIT 5;
