ALTER TABLE affiliate_admin
  ADD COLUMN IF NOT EXISTS login_otp_verified BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE state_admin
  ADD COLUMN IF NOT EXISTS login_otp_verified BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE area_sales_manager
  ADD COLUMN IF NOT EXISTS login_otp_verified BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE branch_admin
  ADD COLUMN IF NOT EXISTS login_otp_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- Anyone who never completed OTP verification should be prompted on next login.
UPDATE affiliate_admin AS admin_row
SET login_otp_verified = FALSE
WHERE admin_row.login_otp_verified = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM login_otp_audit audit
    WHERE LOWER(TRIM(audit.email)) = LOWER(TRIM(admin_row.email))
      AND audit.event_type = 'verify_success'
  );

UPDATE state_admin AS admin_row
SET login_otp_verified = FALSE
WHERE admin_row.login_otp_verified = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM login_otp_audit audit
    WHERE LOWER(TRIM(audit.email)) = LOWER(TRIM(admin_row.email))
      AND audit.event_type = 'verify_success'
  );

UPDATE area_sales_manager AS admin_row
SET login_otp_verified = FALSE
WHERE admin_row.login_otp_verified = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM login_otp_audit audit
    WHERE LOWER(TRIM(audit.email)) = LOWER(TRIM(admin_row.email))
      AND audit.event_type = 'verify_success'
  );

UPDATE branch_admin AS admin_row
SET login_otp_verified = FALSE
WHERE admin_row.login_otp_verified = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM login_otp_audit audit
    WHERE LOWER(TRIM(audit.email)) = LOWER(TRIM(admin_row.email))
      AND audit.event_type = 'verify_success'
  );
