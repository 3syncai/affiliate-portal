import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { findAccountByEmail } from "@/lib/auth/password-reset/account"
import { createPasswordResetToken } from "@/lib/auth/password-reset/token"
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || "").trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 },
      )
    }

    const account = await findAccountByEmail(pool, email)

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "No account found with this email address.",
        },
        { status: 404 },
      )
    }

    if (!account.isActive) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This account is deactivated. Please contact your administrator.",
        },
        { status: 403 },
      )
    }

    const resetToken = await createPasswordResetToken(account)

    await sendPasswordResetEmail({
      to: account.email,
      displayName: account.displayName,
      resetToken,
    })

    return NextResponse.json({
      success: true,
      message:
        "Password reset link sent. Check your email. The link expires in 15 minutes.",
    })
  } catch (error) {
    console.error("[auth/forgot-password] failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send reset link. Please try again later.",
      },
      { status: 500 },
    )
  }
}
