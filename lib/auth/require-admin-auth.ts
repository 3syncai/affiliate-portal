import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "@/lib/env"

export type PortalAdminRole = "admin" | "state" | "asm" | "branch"

type AuthSuccess = { ok: true; userId: string; role: PortalAdminRole }
type AuthFailure = { ok: false; res: NextResponse }
export type PortalAdminAuthResult = AuthSuccess | AuthFailure

export function roleToAdminTable(role: PortalAdminRole): string | null {
  switch (role) {
    case "admin":
      return "affiliate_admin"
    case "state":
      return "state_admin"
    case "asm":
      return "area_sales_manager"
    case "branch":
      return "branch_admin"
    default:
      return null
  }
}

function decodeBearerToken(req: NextRequest): {
  decoded: jwt.JwtPayload | null
  res?: NextResponse
} {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      decoded: null,
      res: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }

  try {
    return {
      decoded: jwt.verify(authHeader.split(" ")[1], getJwtSecret()) as jwt.JwtPayload,
    }
  } catch {
    return {
      decoded: null,
      res: NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      ),
    }
  }
}

export function requirePortalAdminAuth(req: NextRequest): PortalAdminAuthResult {
  const { decoded, res } = decodeBearerToken(req)
  if (!decoded) {
    return { ok: false, res: res! }
  }

  const role = decoded.role as PortalAdminRole
  if (
    role !== "admin" &&
    role !== "state" &&
    role !== "asm" &&
    role !== "branch"
  ) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 403 },
      ),
    }
  }

  if (typeof decoded.id !== "string" || !decoded.id) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, message: "Invalid token payload" },
        { status: 401 },
      ),
    }
  }

  return { ok: true, userId: decoded.id, role }
}
