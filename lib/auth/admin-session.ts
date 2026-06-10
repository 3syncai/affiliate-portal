import type { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/env";
import { readLoginOtpVerified } from "@/lib/auth/admin-login-verification";
import {
  getSubAdminRedirectPath,
  readInitialPasswordResetCompleted,
} from "@/lib/auth/initial-password-reset";
import { normalizeIndianMobile } from "@/lib/login-otp/phone";

export type AdminLoginRole = "admin" | "state" | "asm" | "branch";

export type AdminIdentity = {
  role: AdminLoginRole;
  id: string;
  email: string;
  phone: string;
  passwordHash: string;
  isActive: boolean;
  profileCompleted?: boolean;
  initialPasswordResetCompleted?: boolean;
  loginOtpVerified: boolean;
  record: Record<string, unknown>;
};

export async function findAdminByEmail(
  pool: Pool,
  email: string,
): Promise<AdminIdentity | null> {
  const adminResult = await pool.query(
    `SELECT id, name, email, phone, password_hash,
            COALESCE(login_otp_verified, TRUE) AS login_otp_verified
     FROM affiliate_admin WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
    [email],
  );

  if (adminResult.rows.length > 0) {
    const row = adminResult.rows[0];
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

  const stateResult = await pool.query(
    `SELECT id, first_name, last_name, email, password_hash, phone, state, refer_code, is_active,
            COALESCE(profile_completed, FALSE) AS profile_completed,
            COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
            COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
     FROM state_admin WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
    [email],
  );

  if (stateResult.rows.length > 0) {
    const row = stateResult.rows[0];
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

  const asmResult = await pool.query(
    `SELECT id, first_name, last_name, email, password_hash, phone, city, state, role, is_active, refer_code,
            COALESCE(profile_completed, FALSE) AS profile_completed,
            COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
            COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
     FROM area_sales_manager WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
    [email],
  );

  if (asmResult.rows.length > 0) {
    const row = asmResult.rows[0];
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

  const branchResult = await pool.query(
    `SELECT id, first_name, last_name, email, password_hash, phone, branch, city, state, role, is_active, refer_code,
            COALESCE(profile_completed, FALSE) AS profile_completed,
            COALESCE(login_otp_verified, TRUE) AS login_otp_verified,
            COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
     FROM branch_admin WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
    [email],
  );

  if (branchResult.rows.length > 0) {
    const row = branchResult.rows[0];
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

function buildSubAdminLoginPayload(
  identity: AdminIdentity,
  role: "state" | "asm" | "branch",
  userFields: Record<string, unknown>,
) {
  const profileCompleted = !!identity.profileCompleted;
  const initialPasswordResetCompleted =
    identity.initialPasswordResetCompleted ?? true;

  return {
    success: true,
    message: "Login successful",
    role,
    profile_completed: profileCompleted,
    initial_password_reset_completed: initialPasswordResetCompleted,
    redirectTo: getSubAdminRedirectPath(
      profileCompleted,
      initialPasswordResetCompleted,
    ),
    user: {
      ...userFields,
      profile_completed: profileCompleted,
      initial_password_reset_completed: initialPasswordResetCompleted,
    },
  };
}

export async function verifyAdminPassword(
  identity: AdminIdentity,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, identity.passwordHash);
}

export function getAdminPhoneError(identity: AdminIdentity): string | null {
  const normalized = normalizeIndianMobile(identity.phone);
  if (!normalized) {
    return "No valid mobile number is registered for this account. Contact support.";
  }
  return null;
}

export function buildAdminLoginResponse(identity: AdminIdentity) {
  const tokenPayload: Record<string, unknown> = {
    id: identity.id,
    email: identity.email,
    role: identity.role,
  };

  const row = identity.record;

  if (identity.role === "admin") {
    tokenPayload.role = "admin";
  } else if (identity.role === "state") {
    tokenPayload.state = row.state;
  } else if (identity.role === "asm") {
    tokenPayload.city = row.city;
    tokenPayload.state = row.state;
  } else if (identity.role === "branch") {
    tokenPayload.branch = row.branch;
    tokenPayload.city = row.city;
    tokenPayload.state = row.state;
  }

  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "7d" });

  if (identity.role === "admin") {
    return {
      success: true,
      message: "Login successful",
      token,
      role: "admin",
      user: {
        id: identity.id,
        name: row.name,
        email: identity.email,
        phone: identity.phone,
        role: "admin",
        designation: "National Head",
      },
    };
  }

  if (identity.role === "state") {
    return {
      ...buildSubAdminLoginPayload(identity, "state", {
        id: identity.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: identity.email,
        phone: identity.phone,
        state: row.state,
        refer_code: row.refer_code,
      }),
      token,
    };
  }

  if (identity.role === "asm") {
    return {
      ...buildSubAdminLoginPayload(identity, "asm", {
        id: identity.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: identity.email,
        phone: identity.phone,
        city: row.city,
        state: row.state,
        refer_code: row.refer_code,
      }),
      token,
    };
  }

  return {
    ...buildSubAdminLoginPayload(identity, "branch", {
      id: identity.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: identity.email,
      phone: identity.phone,
      branch: row.branch,
      city: row.city,
      state: row.state,
      refer_code: row.refer_code,
    }),
    token,
  };
}

export async function findAffiliateLogin(
  pool: Pool,
  email: string,
  password: string,
) {
  const query = `
    SELECT id, first_name, last_name, email, password_hash, phone, refer_code,
           branch, area, state, city, designation, is_approved,
           COALESCE(is_active, TRUE) AS is_active,
           created_at
    FROM affiliate_user
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
  `;

  let result;
  try {
    result = await pool.query(query, [email]);
  } catch {
    result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash, phone, refer_code,
              branch, state, city, is_approved, created_at
       FROM affiliate_user WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
      [email],
    );
  }

  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) return null;

  if (user.is_active === false) {
    return { error: "Your account has been deactivated. Please contact admin." };
  }

  let role = "affiliate";
  if (user.designation === "admin") role = "admin";
  else if (user.designation === "state") role = "state";

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role,
      branch: user.branch,
      area: user.area,
      state: user.state,
      city: user.city,
    },
    getJwtSecret(),
    { expiresIn: "7d" },
  );

  return {
    success: true,
    message: "Login successful",
    token,
    role,
    is_approved: user.is_approved,
    redirectTo: !user.is_approved ? "/verification-pending" : null,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      refer_code: user.refer_code,
      branch: user.branch,
      area: user.area,
      state: user.state,
      city: user.city,
      designation: user.designation,
      role,
      is_approved: user.is_approved,
    },
  };
}
