import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import {
  consumeResetToken,
  updateAccountPassword,
  validateResetToken,
} from "@/lib/auth/password-reset/token"
import type { PasswordResetRole } from "@/lib/auth/password-reset/account"
import { validateAdminPassword } from "@/lib/password-policy"

export const dynamic = "force-dynamic"

function validatePasswordForRole(
  role: PasswordResetRole,
  password: string,
): { valid: boolean; message?: string } {
  if (role === "affiliate") {
    if (password.length < 6) {
      return {
        valid: false,
        message: "Password must be at least 6 characters.",
      }
    }
    return { valid: true }
  }

  return validateAdminPassword(password)
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || ""

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Reset link is invalid." },
      { status: 400 },
    )
  }

  const record = await validateResetToken(token)

  if (!record) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This reset link is invalid, expired, or has already been used.",
      },
      { status: 400 },
    )
  }

  return NextResponse.json({
    success: true,
    role: record.userRole,
    message: "Reset link is valid.",
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = String(body.token || "").trim()
    const password = String(body.password || "")
    const confirmPassword = String(body.confirmPassword || "")

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Reset link is invalid." },
        { status: 400 },
      )
    }

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Password and confirmation are required." },
        { status: 400 },
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 },
      )
    }

    const record = await validateResetToken(token)

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This reset link is invalid, expired, or has already been used.",
        },
        { status: 400 },
      )
    }

    const validation = validatePasswordForRole(record.userRole, password)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 },
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await updateAccountPassword(record.userRole, record.userId, passwordHash)
    await consumeResetToken(record.id)

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. You can now sign in.",
    })
  } catch (error) {
    console.error("[auth/reset-password] failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset password. Please try again.",
      },
      { status: 500 },
    )
  }
}
