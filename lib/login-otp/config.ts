function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const loginOtpConfig = {
  ttlMinutes: readInt("LOGIN_OTP_TTL_MINUTES", 10),
  requestWindowMinutes: readInt("LOGIN_OTP_WINDOW_MINUTES", 60),
  maxRequestsPerIp: readInt("LOGIN_OTP_MAX_REQUESTS_PER_IP", 5),
  maxRequestsPerEmail: readInt("LOGIN_OTP_MAX_REQUESTS_PER_EMAIL", 5),
  verifyAttemptWindowMinutes: readInt("LOGIN_OTP_ATTEMPT_WINDOW_MINUTES", 15),
  maxVerifyAttemptsPerIp: readInt("LOGIN_OTP_MAX_VERIFY_ATTEMPTS_PER_IP", 10),
  maxVerifyAttemptsPerCode: readInt("LOGIN_OTP_MAX_VERIFY_ATTEMPTS_PER_CODE", 5),
  auditRetentionDays: readInt("LOGIN_OTP_AUDIT_RETENTION_DAYS", 30),
  retentionHours: readInt("LOGIN_OTP_RETENTION_HOURS", 48),
  requireVerifiedEmail: process.env.LOGIN_OTP_REQUIRE_VERIFIED_EMAIL === "true",
  hashSecret: process.env.LOGIN_OTP_HASH_SECRET || "",
  phoneWindowMinutes: readInt("PHONE_OTP_WINDOW_MINUTES", 10),
  maxRequestsPerPhone: readInt("PHONE_OTP_MAX_REQUESTS_PER_PHONE", 3),
  phoneMaxRequestsPerIp: readInt("PHONE_OTP_MAX_REQUESTS_PER_IP", 3),
  resendCooldownSeconds: readInt("PHONE_OTP_RESEND_COOLDOWN_SECONDS", 30),
};
