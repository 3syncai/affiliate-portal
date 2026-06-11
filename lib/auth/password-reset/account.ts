import type { Pool } from "pg"

export type PasswordResetRole =
  | "admin"
  | "state"
  | "asm"
  | "branch"
  | "affiliate"

export type PasswordResetAccount = {
  role: PasswordResetRole
  id: string
  email: string
  displayName: string
  isActive: boolean
}

export function roleToPasswordTable(role: PasswordResetRole): string {
  switch (role) {
    case "admin":
      return "affiliate_admin"
    case "state":
      return "state_admin"
    case "asm":
      return "area_sales_manager"
    case "branch":
      return "branch_admin"
    case "affiliate":
      return "affiliate_user"
    default:
      throw new Error(`Unsupported role: ${role}`)
  }
}

export async function findAccountByEmail(
  pool: Pool,
  email: string,
): Promise<PasswordResetAccount | null> {
  const normalized = email.trim().toLowerCase()

  const adminResult = await pool.query(
    `SELECT id, name, email FROM affiliate_admin
     WHERE LOWER(TRIM(email)) = $1`,
    [normalized],
  )
  if (adminResult.rows.length > 0) {
    const row = adminResult.rows[0]
    return {
      role: "admin",
      id: String(row.id),
      email: row.email,
      displayName: row.name || row.email,
      isActive: true,
    }
  }

  const stateResult = await pool.query(
    `SELECT id, first_name, last_name, email, is_active
     FROM state_admin WHERE LOWER(TRIM(email)) = $1`,
    [normalized],
  )
  if (stateResult.rows.length > 0) {
    const row = stateResult.rows[0]
    return {
      role: "state",
      id: String(row.id),
      email: row.email,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
      isActive: Boolean(row.is_active),
    }
  }

  const asmResult = await pool.query(
    `SELECT id, first_name, last_name, email, is_active
     FROM area_sales_manager WHERE LOWER(TRIM(email)) = $1`,
    [normalized],
  )
  if (asmResult.rows.length > 0) {
    const row = asmResult.rows[0]
    return {
      role: "asm",
      id: String(row.id),
      email: row.email,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
      isActive: Boolean(row.is_active),
    }
  }

  const branchResult = await pool.query(
    `SELECT id, first_name, last_name, email, is_active
     FROM branch_admin WHERE LOWER(TRIM(email)) = $1`,
    [normalized],
  )
  if (branchResult.rows.length > 0) {
    const row = branchResult.rows[0]
    return {
      role: "branch",
      id: String(row.id),
      email: row.email,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
      isActive: Boolean(row.is_active),
    }
  }

  let affiliateResult
  try {
    affiliateResult = await pool.query(
      `SELECT id, first_name, last_name, email,
              COALESCE(is_active, TRUE) AS is_active
       FROM affiliate_user WHERE LOWER(TRIM(email)) = $1`,
      [normalized],
    )
  } catch {
    affiliateResult = await pool.query(
      `SELECT id, first_name, last_name, email
       FROM affiliate_user WHERE LOWER(TRIM(email)) = $1`,
      [normalized],
    )
  }

  if (affiliateResult.rows.length > 0) {
    const row = affiliateResult.rows[0]
    return {
      role: "affiliate",
      id: String(row.id),
      email: row.email,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
      isActive: row.is_active !== false,
    }
  }

  return null
}
