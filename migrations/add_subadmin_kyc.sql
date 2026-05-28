-- Migration: Sub-admin KYC + bank details gate
-- Adds profile_completed flag and KYC/bank columns to state_admin, area_sales_manager, branch_admin.
-- When profile_completed = FALSE the front-end blocks dashboard access and forces the
-- /complete-profile flow. Existing rows default to FALSE so they will also be prompted.

-- ────────────────────────────────────────────────────────────────────
-- state_admin
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE state_admin
    ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pan_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pan_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS aadhar_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS aadhar_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- ────────────────────────────────────────────────────────────────────
-- area_sales_manager (the "Branch Head" tier in product terminology)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE area_sales_manager
    ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pan_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pan_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS aadhar_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS aadhar_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- ────────────────────────────────────────────────────────────────────
-- branch_admin (the "ASM" tier in product terminology)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE branch_admin
    ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pan_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pan_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS aadhar_card_no VARCHAR(20),
    ADD COLUMN IF NOT EXISTS aadhar_card_photo TEXT,
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
