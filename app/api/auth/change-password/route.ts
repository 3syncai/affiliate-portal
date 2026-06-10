import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import pool from "@/lib/db"
import {
  requirePortalAdminAuth,
  roleToAdminTable,
} from "@/lib/auth/require-admin-auth"
import { validateAdminPassword } from "@/lib/password-policy"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const auth = requirePortalAdminAuth(req)
    if (!auth.ok) return auth.res

    const table = roleToAdminTable(auth.role)
    if (!table) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 403 },
      )
    }

    const body = await req.json()
    const currentPassword = String(body.currentPassword || "")
    const newPassword = String(body.newPassword || "")
    const confirmPassword = String(body.confirmPassword || "")

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "All password fields are required." },
        { status: 400 },
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "New password and confirmation do not match." },
        { status: 400 },
      )
    }

    const validation = validateAdminPassword(newPassword)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 },
      )
    }

    const userResult = await pool.query(
      `SELECT id, password_hash FROM ${table} WHERE id = $1`,
      [auth.userId],
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Account not found." },
        { status: 404 },
      )
    }

    const user = userResult.rows[0]
    const currentValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    )

    if (!currentValid) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 400 },
      )
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash)
    if (sameAsCurrent) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be different from your current password.",
        },
        { status: 400 },
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await pool.query(
      `UPDATE ${table}
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, auth.userId],
    )

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    })
  } catch (error) {
    console.error("[auth/change-password] failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to change password.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
