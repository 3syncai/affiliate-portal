import pool from "@/lib/db";
import type { AdminLoginRole } from "@/lib/auth/admin-session";

let schemaReady: Promise<void> | null = null;

const ADMIN_TABLES = [
  "affiliate_admin",
  "state_admin",
  "area_sales_manager",
  "branch_admin",
] as const;

const BACKFILL_TABLES: Array<{ table: string; emailColumn: string }> = [
  { table: "state_admin", emailColumn: "email" },
  { table: "area_sales_manager", emailColumn: "email" },
  { table: "branch_admin", emailColumn: "email" },
];

export async function ensureAdminLoginVerificationSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const table of ADMIN_TABLES) {
        await pool.query(
          `ALTER TABLE ${table}
           ADD COLUMN IF NOT EXISTS login_otp_verified BOOLEAN NOT NULL DEFAULT TRUE`,
        );
      }

      // National Head is exempt from first-login OTP verification.
      await pool.query(
        `UPDATE affiliate_admin SET login_otp_verified = TRUE`,
      );

      await backfillLoginOtpVerifiedFromAudit();
    })();
  }

  await schemaReady;
}

/**
 * Admins created before `login_otp_verified = FALSE` on insert were marked verified
 * by the column default. Reset anyone who never completed OTP verification.
 */
export async function backfillLoginOtpVerifiedFromAudit(): Promise<void> {
  const auditTable = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'login_otp_audit'
    ) AS exists
  `);

  if (!auditTable.rows[0]?.exists) {
    return;
  }

  for (const { table, emailColumn } of BACKFILL_TABLES) {
    await pool.query(
      `
      UPDATE ${table} AS admin_row
      SET login_otp_verified = FALSE
      WHERE admin_row.login_otp_verified = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM login_otp_audit audit
          WHERE LOWER(TRIM(audit.email)) = LOWER(TRIM(admin_row.${emailColumn}))
            AND audit.event_type = 'verify_success'
        )
      `,
    );
  }
}

export function readLoginOtpVerified(
  row: Record<string, unknown>,
): boolean {
  if (row.login_otp_verified === undefined || row.login_otp_verified === null) {
    return true;
  }
  return Boolean(row.login_otp_verified);
}

export async function markAdminLoginOtpVerified(
  role: AdminLoginRole,
  userId: string,
): Promise<void> {
  await ensureAdminLoginVerificationSchema();

  const table =
    role === "admin"
      ? "affiliate_admin"
      : role === "state"
        ? "state_admin"
        : role === "asm"
          ? "area_sales_manager"
          : "branch_admin";

  await pool.query(
    `UPDATE ${table} SET login_otp_verified = TRUE WHERE id = $1`,
    [userId],
  );
}
