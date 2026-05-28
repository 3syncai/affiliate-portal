-- Migration: Sub-admin KYC + bank details gate
-- Adds profile_completed flag and KYC/bank columns to state_admin, area_sales_manager, branch_admin.
-- When profile_completed = FALSE the front-end blocks dashboard access and forces the
-- /complete-profile flow. Existing rows default to FALSE so they will also be prompted.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ DPDPA / encryption follow-up (TRACKED — not in this migration)           │
-- ├──────────────────────────────────────────────────────────────────────────┤
-- │ pan_card_no, aadhar_card_no and the corresponding *_photo URLs are       │
-- │ sensitive personal identifiers under India's Digital Personal Data       │
-- │ Protection Act, 2023 (DPDPA). Storing them as plaintext VARCHAR/TEXT is  │
-- │ a known compliance gap.                                                  │
-- │                                                                          │
-- │ A follow-up migration is planned to introduce envelope encryption:       │
-- │   - new BYTEA columns:  pan_card_no_cipher, aadhar_card_no_cipher        │
-- │   - matching IV columns: pan_card_no_iv, aadhar_card_no_iv               │
-- │   - key version column for rotation: pan_card_no_keyver, etc.            │
-- │   - KMS-backed envelope encryption in the app layer (AES-256-GCM)        │
-- │   - signed/expiring URLs for *_photo references instead of static paths  │
-- │ Plus a backfill that re-encrypts existing plaintext rows and drops the   │
-- │ legacy columns.                                                          │
-- │                                                                          │
-- │ Until that lands, restrict bucket access to authenticated admin paths    │
-- │ only and audit reads. Do NOT expand reads of these columns beyond the    │
-- │ existing flows.                                                          │
-- └──────────────────────────────────────────────────────────────────────────┘

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
