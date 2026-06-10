import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  buildAdminLoginResponse,
  findAdminByEmail,
  findAffiliateLogin,
  getAdminPhoneError,
  verifyAdminPassword,
} from "@/lib/auth/admin-session";
import { ensureAdminLoginVerificationSchema } from "@/lib/auth/admin-login-verification";
import { requiresLoginOtp } from "@/lib/auth/login-otp-policy";
import { ensureInitialPasswordResetSchema } from "@/lib/auth/initial-password-reset";
import { ensureLoginOtpSchema } from "@/lib/login-otp/schema";
import {
  createLoginOtpChallenge,
  LoginOtpError,
} from "@/lib/login-otp/service";
import { getRequestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 },
      );
    }

    await ensureLoginOtpSchema();
    await ensureAdminLoginVerificationSchema();
    await ensureInitialPasswordResetSchema();

    const ipAddress = getRequestIp(req);
    const admin = await findAdminByEmail(pool, email);

    if (admin) {
      if (!admin.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: "Account is deactivated. Please contact admin.",
          },
          { status: 403 },
        );
      }

      const passwordValid = await verifyAdminPassword(admin, password);
      if (!passwordValid) {
        return NextResponse.json(
          { success: false, message: "Invalid email or password" },
          { status: 401 },
        );
      }

      // National Head: email + password only. OTP is for state / asm / branch.
      if (!requiresLoginOtp(admin.role)) {
        return NextResponse.json(buildAdminLoginResponse(admin));
      }

      if (admin.loginOtpVerified) {
        return NextResponse.json(buildAdminLoginResponse(admin));
      }

      const phoneError = getAdminPhoneError(admin);
      if (phoneError) {
        return NextResponse.json(
          { success: false, message: phoneError },
          { status: 400 },
        );
      }

      const challenge = await createLoginOtpChallenge(admin, ipAddress);

      return NextResponse.json({
        success: true,
        requiresOtp: true,
        message:
          "First-time verification: OTP sent to your registered mobile number.",
        challengeId: challenge.challengeId,
        maskedPhone: challenge.maskedPhone,
        expiresInSeconds: challenge.expiresInSeconds,
        resendCooldownSeconds: challenge.resendCooldownSeconds,
      });
    }

    const affiliateResult = await findAffiliateLogin(pool, email, password);
    if (!affiliateResult) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 },
      );
    }

    if ("error" in affiliateResult) {
      return NextResponse.json(
        { success: false, message: affiliateResult.error },
        { status: 403 },
      );
    }

    return NextResponse.json(affiliateResult);
  } catch (error) {
    if (error instanceof LoginOtpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("[auth/login] failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Login failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
