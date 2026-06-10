import pool from "@/lib/db";

const SUBADMIN_TABLES = [
  "state_admin",
  "area_sales_manager",
  "branch_admin",
] as const;

let schemaReady: Promise<void> | null = null;

export async function ensureInitialPasswordResetSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const table of SUBADMIN_TABLES) {
        await pool.query(
          `ALTER TABLE ${table}
           ADD COLUMN IF NOT EXISTS initial_password_reset_completed BOOLEAN NOT NULL DEFAULT TRUE`,
        );
      }

      await pool.query(`
        UPDATE state_admin
        SET initial_password_reset_completed = FALSE
        WHERE profile_completed = FALSE
      `);
      await pool.query(`
        UPDATE area_sales_manager
        SET initial_password_reset_completed = FALSE
        WHERE profile_completed = FALSE
      `);
      await pool.query(`
        UPDATE branch_admin
        SET initial_password_reset_completed = FALSE
        WHERE profile_completed = FALSE
      `);
    })();
  }

  await schemaReady;
}

export function readInitialPasswordResetCompleted(
  row: Record<string, unknown>,
): boolean {
  if (
    row.initial_password_reset_completed === undefined ||
    row.initial_password_reset_completed === null
  ) {
    return true;
  }
  return Boolean(row.initial_password_reset_completed);
}

export function getSubAdminRedirectPath(
  profileCompleted: boolean,
  initialPasswordResetCompleted: boolean,
): string | null {
  if (!profileCompleted) {
    return "/complete-profile";
  }
  if (!initialPasswordResetCompleted) {
    return "/reset-initial-password";
  }
  return null;
}

export async function markInitialPasswordResetCompleted(
  table: "state_admin" | "area_sales_manager" | "branch_admin",
  userId: string,
): Promise<void> {
  await ensureInitialPasswordResetSchema();
  await pool.query(
    `UPDATE ${table} SET initial_password_reset_completed = TRUE, updated_at = NOW() WHERE id = $1`,
    [userId],
  );
}

export function roleToSubAdminTable(role: string): typeof SUBADMIN_TABLES[number] | null {
  if (role === "state") return "state_admin";
  if (role === "asm") return "area_sales_manager";
  if (role === "branch") return "branch_admin";
  return null;
}
