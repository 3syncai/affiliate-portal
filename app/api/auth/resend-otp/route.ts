import { NextRequest, NextResponse } from "next/server";
import {
  LoginOtpError,
  resendLoginOtpChallenge,
} from "@/lib/login-otp/service";
import { getRequestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const challengeId = String(body.challengeId || "").trim();

    if (!challengeId) {
      return NextResponse.json(
        { success: false, message: "Session expired. Please sign in again." },
        { status: 400 },
      );
    }

    const result = await resendLoginOtpChallenge(
      challengeId,
      getRequestIp(req),
    );

    return NextResponse.json({
      success: true,
      message: "OTP resent to your registered mobile number.",
      maskedPhone: result.maskedPhone,
      expiresInSeconds: result.expiresInSeconds,
      resendCooldownSeconds: result.resendCooldownSeconds,
    });
  } catch (error) {
    if (error instanceof LoginOtpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("[auth/resend-otp] failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to resend OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
