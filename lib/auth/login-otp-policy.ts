import type { AdminLoginRole } from "@/lib/auth/admin-session"

/** Sub-admins who must verify mobile OTP on first login. */
export const LOGIN_OTP_ROLES: readonly AdminLoginRole[] = [
  "state",
  "asm",
  "branch",
]

export function requiresLoginOtp(role: AdminLoginRole): boolean {
  return role === "state" || role === "asm" || role === "branch"
}

export function isLoginOtpRole(role: string): role is AdminLoginRole {
  return role === "state" || role === "asm" || role === "branch"
}
