import { createHmac, randomBytes } from "crypto"
import pool from "@/lib/db"
import { ensurePasswordResetSchema } from "@/lib/auth/password-reset/schema"
import type { PasswordResetAccount } from "@/lib/auth/password-reset/account"

const RESET_TTL_MINUTES = 15

function getHashSecret(): string {
  return (
    process.env.PASSWORD_RESET_HASH_SECRET ||
    process.env.LOGIN_OTP_HASH_SECRET ||
    process.env.JWT_SECRET ||
    "password-reset-fallback"
  )
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex")
}

export function hashResetToken(token: string): string {
  return createHmac("sha256", getHashSecret()).update(token).digest("hex")
}

export async function createPasswordResetToken(
  account: PasswordResetAccount,
): Promise<string> {
  await ensurePasswordResetSchema()

  const rawToken = generateResetToken()
  const tokenHash = hashResetToken(rawToken)
  const email = account.email.trim().toLowerCase()

  await pool.query(
    `UPDATE password_reset_token
     SET used_at = NOW()
     WHERE LOWER(TRIM(email)) = $1 AND used_at IS NULL`,
    [email],
  )

  await pool.query(
    `INSERT INTO password_reset_token (
      email, user_role, user_id, token_hash, expires_at
    ) VALUES ($1, $2, $3, $4, NOW() + ($5::int * INTERVAL '1 minute'))`,
    [email, account.role, account.id, tokenHash, RESET_TTL_MINUTES],
  )

  return rawToken
}

export type ValidResetToken = {
  id: string
  email: string
  userRole: PasswordResetAccount["role"]
  userId: string
}

export async function validateResetToken(
  rawToken: string,
): Promise<ValidResetToken | null> {
  await ensurePasswordResetSchema()

  if (!rawToken || rawToken.length < 32) {
    return null
  }

  const tokenHash = hashResetToken(rawToken)

  const result = await pool.query(
    `SELECT id, email, user_role, user_id, expires_at, used_at
     FROM password_reset_token
     WHERE token_hash = $1`,
    [tokenHash],
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]

  if (row.used_at) {
    return null
  }

  if (new Date(row.expires_at) < new Date()) {
    return null
  }

  return {
    id: String(row.id),
    email: row.email,
    userRole: row.user_role as PasswordResetAccount["role"],
    userId: String(row.user_id),
  }
}

export async function consumeResetToken(tokenId: string): Promise<void> {
  await pool.query(
    `UPDATE password_reset_token SET used_at = NOW() WHERE id = $1`,
    [tokenId],
  )
}

export async function updateAccountPassword(
  role: PasswordResetAccount["role"],
  userId: string,
  passwordHash: string,
): Promise<void> {
  const table =
    role === "admin"
      ? "affiliate_admin"
      : role === "state"
        ? "state_admin"
        : role === "asm"
          ? "area_sales_manager"
          : role === "branch"
            ? "branch_admin"
            : "affiliate_user"

  await pool.query(
    `UPDATE ${table} SET password_hash = $1 WHERE id = $2`,
    [passwordHash, userId],
  )
}
