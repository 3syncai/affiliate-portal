import { NextRequest, NextResponse } from "next/server";
import { buildAdminLoginResponse } from "@/lib/auth/admin-session";
import {
  LoginOtpError,
  verifyLoginOtpChallenge,
} from "@/lib/login-otp/service";
import { getRequestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const challengeId = String(body.challengeId || "").trim();
    const otp = String(body.otp || "").trim();

    if (!challengeId || !otp) {
      return NextResponse.json(
        { success: false, message: "OTP and session are required" },
        { status: 400 },
      );
    }

    const identity = await verifyLoginOtpChallenge(
      challengeId,
      otp,
      getRequestIp(req),
    );

    return NextResponse.json(buildAdminLoginResponse(identity));
  } catch (error) {
    if (error instanceof LoginOtpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("[auth/verify-otp] failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "OTP verification failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
