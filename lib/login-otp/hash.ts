import { createHmac, randomInt } from "crypto";
import { loginOtpConfig } from "@/lib/login-otp/config";

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOtp(code: string, challengeId: string): string {
  const secret = loginOtpConfig.hashSecret || process.env.JWT_SECRET || "otp-fallback";
  return createHmac("sha256", secret)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function verifyOtpHash(
  code: string,
  challengeId: string,
  expectedHash: string,
): boolean {
  const actual = hashOtp(code, challengeId);
  return actual === expectedHash;
}
