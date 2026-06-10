import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import {
  ensureInitialPasswordResetSchema,
  markInitialPasswordResetCompleted,
  readInitialPasswordResetCompleted,
  roleToSubAdminTable,
} from "@/lib/auth/initial-password-reset";
import { validateAdminPassword } from "@/lib/password-policy";
import { requireAnySubAdminAuth } from "@/lib/sub-admin-auth";

export const dynamic = "force-dynamic";

const DASHBOARD_BY_ROLE: Record<string, string> = {
  state: "/state-admin/dashboard",
  asm: "/asm/dashboard",
  branch: "/branch/dashboard",
};

export async function POST(req: NextRequest) {
  try {
    const auth = requireAnySubAdminAuth(req);
    if (!auth.ok) return auth.res;

    await ensureInitialPasswordResetSchema();

    const table = roleToSubAdminTable(auth.role);
    if (!table) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Password and confirmation are required." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 },
      );
    }

    const validation = validateAdminPassword(password);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 },
      );
    }

    const userResult = await pool.query(
      `SELECT id, email, password_hash,
              COALESCE(profile_completed, FALSE) AS profile_completed,
              COALESCE(initial_password_reset_completed, TRUE) AS initial_password_reset_completed
       FROM ${table}
       WHERE id = $1`,
      [auth.userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Account not found." },
        { status: 404 },
      );
    }

    const user = userResult.rows[0];

    if (!user.profile_completed) {
      return NextResponse.json(
        {
          success: false,
          message: "Complete your profile before resetting your password.",
          redirectTo: "/complete-profile",
        },
        { status: 400 },
      );
    }

    if (readInitialPasswordResetCompleted(user)) {
      return NextResponse.json(
        {
          success: false,
          message: "Password has already been set.",
          redirectTo: DASHBOARD_BY_ROLE[auth.role],
        },
        { status: 400 },
      );
    }

    const sameAsCurrent = await bcrypt.compare(password, user.password_hash);
    if (sameAsCurrent) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose a new password different from the one emailed to you.",
        },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE ${table}
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, auth.userId],
    );

    await markInitialPasswordResetCompleted(table, auth.userId);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      redirectTo: DASHBOARD_BY_ROLE[auth.role],
      initial_password_reset_completed: true,
    });
  } catch (error) {
    console.error("[auth/reset-initial-password] failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset password.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
