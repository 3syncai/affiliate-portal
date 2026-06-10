import { randomUUID } from "crypto";
import pool from "@/lib/db";
import type { AdminIdentity } from "@/lib/auth/admin-session";
import { isLoginOtpRole, requiresLoginOtp } from "@/lib/auth/login-otp-policy";
import {
  markAdminLoginOtpVerified,
  readLoginOtpVerified,
} from "@/lib/auth/admin-login-verification";
import { readInitialPasswordResetCompleted } from "@/lib/auth/initial-password-reset";
import { loginOtpConfig } from "@/lib/login-otp/config";
import { generateOtpCode, hashOtp, verifyOtpHash } from "@/lib/login-otp/hash";
import { maskPhone, normalizeIndianMobile } from "@/lib/login-otp/phone";
import { ensureLoginOtpSchema } from "@/lib/login-otp/schema";
import { sendLoginOtpSms } from "@/lib/msg91/send-sms-otp";

type AuditEvent =
  | "request"
  | "verify_success"
  | "verify_fail"
  | "resend"
  | "rate_limited";

async function writeAudit(
  eventType: AuditEvent,
  email: string | null,
  phone: string | null,
  ipAddress: string,
  challengeId?: string,
  metadata?: Record<string, unknown>,
) {
  await pool.query(
    `INSERT INTO login_otp_audit (event_type, email, phone, ip_address, challenge_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      eventType,
      email,
      phone,
      ipAddress,
      challengeId || null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

async function countAuditEvents(
  column: "ip_address" | "email" | "phone",
  value: string,
  eventTypes: AuditEvent[],
  windowMinutes: number,
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM login_otp_audit
     WHERE ${column} = $1
       AND event_type = ANY($2::text[])
       AND created_at >= NOW() - ($3::int * INTERVAL '1 minute')`,
    [value, eventTypes, windowMinutes],
  );
  return result.rows[0]?.count || 0;
}

async function countVerifyFailures(
  column: "ip_address" | "challenge_id",
  value: string,
  windowMinutes: number,
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM login_otp_audit
     WHERE ${column} = $1
       AND event_type = 'verify_fail'
       AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')`,
    [value, windowMinutes],
  );
  return result.rows[0]?.count || 0;
}

export class LoginOtpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function enforceRequestRateLimits(
  email: string,
  phone: string,
  ipAddress: string,
) {
  const ipCount = await countAuditEvents(
    "ip_address",
    ipAddress,
    ["request", "resend"],
    loginOtpConfig.requestWindowMinutes,
  );
  if (ipCount >= loginOtpConfig.maxRequestsPerIp) {
    throw new LoginOtpError(
      "Too many OTP requests from this network. Please try again later.",
      429,
    );
  }

  const emailCount = await countAuditEvents(
    "email",
    email,
    ["request", "resend"],
    loginOtpConfig.requestWindowMinutes,
  );
  if (emailCount >= loginOtpConfig.maxRequestsPerEmail) {
    throw new LoginOtpError(
      "Too many OTP requests for this account. Please try again later.",
      429,
    );
  }

  const phoneIpCount = await countAuditEvents(
    "ip_address",
    ipAddress,
    ["request", "resend"],
    loginOtpConfig.phoneWindowMinutes,
  );
  if (phoneIpCount >= loginOtpConfig.phoneMaxRequestsPerIp) {
    throw new LoginOtpError(
      "Too many OTP requests from this network. Please try again later.",
      429,
    );
  }

  const phoneCount = await countAuditEvents(
    "phone",
    phone,
    ["request", "resend"],
    loginOtpConfig.phoneWindowMinutes,
  );
  if (phoneCount >= loginOtpConfig.maxRequestsPerPhone) {
    throw new LoginOtpError(
      "Too many OTP requests for this mobile number. Please try again later.",
      429,
    );
  }
}

async function sendChallengeOtp(
  challengeId: string,
  phone: string,
  ipAddress: string,
  email: string,
  eventType: "request" | "resend",
) {
  const otp = generateOtpCode();
  const otpHash = hashOtp(otp, challengeId);
  const expiresAt = new Date(
    Date.now() + loginOtpConfig.ttlMinutes * 60 * 1000,
  );

  await pool.query(
    `UPDATE login_otp_challenge
     SET otp_hash = $2, expires_at = $3, last_sent_at = NOW(), verify_attempts = 0
     WHERE id = $1`,
    [challengeId, otpHash, expiresAt],
  );

  await sendLoginOtpSms(phone, otp, loginOtpConfig.ttlMinutes);
  await writeAudit(eventType, email, phone, ipAddress, challengeId);
}

export async function createLoginOtpChallenge(
  identity: AdminIdentity,
  ipAddress: string,
) {
  if (!requiresLoginOtp(identity.role)) {
    throw new LoginOtpError(
      "OTP verification applies only to State Admin, Branch Manager, and Area Sales Manager accounts.",
      403,
    );
  }

  await ensureLoginOtpSchema();

  const phone = normalizeIndianMobile(identity.phone);
  if (!phone) {
    throw new LoginOtpError(
      "No valid mobile number is registered for this account. Contact support.",
      400,
    );
  }

  await enforceRequestRateLimits(identity.email, phone, ipAddress);

  const challengeId = randomUUID();
  const otp = generateOtpCode();
  const otpHash = hashOtp(otp, challengeId);
  const expiresAt = new Date(
    Date.now() + loginOtpConfig.ttlMinutes * 60 * 1000,
  );

  await pool.query(
    `INSERT INTO login_otp_challenge (
      id, email, role, user_id, phone, otp_hash, expires_at, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      challengeId,
      identity.email,
      identity.role,
      identity.id,
      phone,
      otpHash,
      expiresAt,
      ipAddress,
    ],
  );

  try {
    await sendLoginOtpSms(phone, otp, loginOtpConfig.ttlMinutes);
  } catch (error) {
    await pool.query(`DELETE FROM login_otp_challenge WHERE id = $1`, [
      challengeId,
    ]);
    throw new LoginOtpError(
      "Failed to send OTP SMS. Please try again in a moment.",
      503,
    );
  }

  await writeAudit("request", identity.email, phone, ipAddress, challengeId);

  return {
    challengeId,
    maskedPhone: maskPhone(phone),
    expiresInSeconds: loginOtpConfig.ttlMinutes * 60,
    resendCooldownSeconds: loginOtpConfig.resendCooldownSeconds,
  };
}

export async function resendLoginOtpChallenge(
  challengeId: string,
  ipAddress: string,
) {
  await ensureLoginOtpSchema();

  const result = await pool.query(
    `SELECT id, email, phone, role, consumed_at, last_sent_at, expires_at
     FROM login_otp_challenge
     WHERE id = $1`,
    [challengeId],
  );

  if (result.rows.length === 0) {
    throw new LoginOtpError("OTP session expired. Please sign in again.", 400);
  }

  const challenge = result.rows[0];
  if (!isLoginOtpRole(challenge.role)) {
    throw new LoginOtpError(
      "OTP verification applies only to State Admin, Branch Manager, and Area Sales Manager accounts.",
      403,
    );
  }
  if (challenge.consumed_at) {
    throw new LoginOtpError("OTP already used. Please sign in again.", 400);
  }

  if (new Date(challenge.expires_at) < new Date()) {
    throw new LoginOtpError("OTP expired. Please sign in again.", 400);
  }

  const secondsSinceSend =
    (Date.now() - new Date(challenge.last_sent_at).getTime()) / 1000;
  if (secondsSinceSend < loginOtpConfig.resendCooldownSeconds) {
    const wait = Math.ceil(
      loginOtpConfig.resendCooldownSeconds - secondsSinceSend,
    );
    throw new LoginOtpError(
      `Please wait ${wait} seconds before requesting another OTP.`,
      429,
    );
  }

  await enforceRequestRateLimits(
    challenge.email,
    challenge.phone,
    ipAddress,
  );

  await sendChallengeOtp(
    challengeId,
    challenge.phone,
    ipAddress,
    challenge.email,
    "resend",
  );

  return {
    maskedPhone: maskPhone(challenge.phone),
    expiresInSeconds: loginOtpConfig.ttlMinutes * 60,
    resendCooldownSeconds: loginOtpConfig.resendCooldownSeconds,
  };
}

export async function verifyLoginOtpChallenge(
  challengeId: string,
  otpCode: string,
  ipAddress: string,
): Promise<AdminIdentity> {
  await ensureLoginOtpSchema();

  const ipFailures = await countVerifyFailures(
    "ip_address",
    ipAddress,
    loginOtpConfig.verifyAttemptWindowMinutes,
  );
  if (ipFailures >= loginOtpConfig.maxVerifyAttemptsPerIp) {
    throw new LoginOtpError(
      "Too many incorrect OTP attempts. Please try again later.",
      429,
    );
  }

  const result = await pool.query(
    `SELECT id, email, role, user_id, phone, otp_hash, expires_at, verify_attempts, consumed_at
     FROM login_otp_challenge
     WHERE id = $1`,
    [challengeId],
  );

  if (result.rows.length === 0) {
    throw new LoginOtpError("OTP session expired. Please sign in again.", 400);
  }

  const challenge = result.rows[0];

  if (!isLoginOtpRole(challenge.role)) {
    throw new LoginOtpError(
      "OTP verification applies only to State Admin, Branch Manager, and Area Sales Manager accounts.",
      403,
    );
  }

  if (challenge.consumed_at) {
    throw new LoginOtpError("OTP already used. Please sign in again.", 400);
  }

  if (new Date(challenge.expires_at) < new Date()) {
    throw new LoginOtpError("OTP expired. Please sign in again.", 400);
  }

  if (challenge.verify_attempts >= loginOtpConfig.maxVerifyAttemptsPerCode) {
    throw new LoginOtpError(
      "Too many incorrect OTP attempts. Please sign in again.",
      429,
    );
  }

  const normalizedOtp = otpCode.replace(/\D/g, "");
  const isValid = verifyOtpHash(
    normalizedOtp,
    challengeId,
    challenge.otp_hash,
  );

  if (!isValid) {
    await pool.query(
      `UPDATE login_otp_challenge
       SET verify_attempts = verify_attempts + 1
       WHERE id = $1`,
      [challengeId],
    );
    await writeAudit(
      "verify_fail",
      challenge.email,
      challenge.phone,
      ipAddress,
      challengeId,
    );
    throw new LoginOtpError("Invalid OTP. Please try again.", 401);
  }

  await pool.query(
    `UPDATE login_otp_challenge SET consumed_at = NOW() WHERE id = $1`,
    [challengeId],
  );
  await writeAudit(
    "verify_success",
    challenge.email,
    challenge.phone,
    ipAddress,
    challengeId,
  );

  const identity = await loadAdminIdentity(
    challenge.role,
    challenge.user_id,
    challenge.email,
  );

  if (!identity || !identity.isActive) {
    throw new LoginOtpError(
      "Account is no longer active. Please contact support.",
      403,
    );
  }

  await markAdminLoginOtpVerified(identity.role, identity.id);

  return identity;
}

async function loadAdminIdentity(
  role: string,
  userId: string,
  email: string,
): Promise<AdminIdentity | null> {
  if (role === "admin") {
    const result = await pool.query(
      `SELECT id, name, email, phone, password_hash,
              COALESCE(login_otp_verified, TRUE) AS login_otp_verified
       FROM affiliate_admin WHERE id = $1`,
      [userId],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      role: "admin",
      id: String(row.id),
      email: row.email,
      phone: row.phone || "",
      passwordHash: row.password_hash,
      isActive: true,
      loginOtpVerified: readLoginOtpVerified(row),
      record: row,
    };
  }

  if (role === "state") {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, state, refer_code, is_active,
              COALESCE(profile_completed, FALSE) AS profile_completed,
              COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
              COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
       FROM state_admin WHERE id = $1`,
      [userId],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      role: "state",
      id: String(row.id),
      email: row.email,
      phone: row.phone || "",
      passwordHash: row.password_hash,
      isActive: row.is_active,
      profileCompleted: !!row.profile_completed,
      initialPasswordResetCompleted: readInitialPasswordResetCompleted(row),
      loginOtpVerified: readLoginOtpVerified(row),
      record: row,
    };
  }

  if (role === "asm") {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, city, state, role, is_active, refer_code,
              COALESCE(profile_completed, FALSE) AS profile_completed,
              COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
              COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
       FROM area_sales_manager WHERE id = $1`,
      [userId],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      role: "asm",
      id: String(row.id),
      email: row.email,
      phone: row.phone || "",
      passwordHash: row.password_hash,
      isActive: row.is_active,
      profileCompleted: !!row.profile_completed,
      initialPasswordResetCompleted: readInitialPasswordResetCompleted(row),
      loginOtpVerified: readLoginOtpVerified(row),
      record: row,
    };
  }

  if (role === "branch") {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, branch, city, state, role, is_active, refer_code,
              COALESCE(profile_completed, FALSE) AS profile_completed,
              COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
              COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
       FROM branch_admin WHERE id = $1`,
      [userId],
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      role: "branch",
      id: String(row.id),
      email: row.email,
      phone: row.phone || "",
      passwordHash: row.password_hash,
      isActive: row.is_active,
      profileCompleted: !!row.profile_completed,
      initialPasswordResetCompleted: readInitialPasswordResetCompleted(row),
      loginOtpVerified: readLoginOtpVerified(row),
      record: row,
    };
  }

  return null;
}
