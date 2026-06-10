ALTER TABLE state_admin
  ADD COLUMN IF NOT EXISTS initial_password_reset_completed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE area_sales_manager
  ADD COLUMN IF NOT EXISTS initial_password_reset_completed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE branch_admin
  ADD COLUMN IF NOT EXISTS initial_password_reset_completed BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE state_admin
SET initial_password_reset_completed = FALSE
WHERE profile_completed = FALSE;

UPDATE area_sales_manager
SET initial_password_reset_completed = FALSE
WHERE profile_completed = FALSE;

UPDATE branch_admin
SET initial_password_reset_completed = FALSE
WHERE profile_completed = FALSE;
