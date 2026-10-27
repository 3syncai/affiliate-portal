import { NextRequest, NextResponse } from "next/server";
import { requirePortalAdminAuth } from "./require-admin-auth";
export function requireCommissionAdmin(req: NextRequest) {
  const auth = requirePortalAdminAuth(req);
  if (!auth.ok) return auth;
  if (auth.role !== "admin") return { ok: false as const, res: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }) };
  return auth;
}
