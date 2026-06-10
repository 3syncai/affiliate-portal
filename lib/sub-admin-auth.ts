import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "@/lib/env"

export type SubAdminRole = "asm" | "branch" | "state"

type AuthSuccess = { ok: true; userId: string; role: SubAdminRole }
type AuthFailure = { ok: false; res: NextResponse }
export type AuthResult = AuthSuccess | AuthFailure

function decodeBearerToken(req: NextRequest): { decoded: jwt.JwtPayload | null; res?: NextResponse } {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            decoded: null,
            res: NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            ),
        }
    }

    const token = authHeader.split(" ")[1]
    try {
        return { decoded: jwt.verify(token, getJwtSecret()) as jwt.JwtPayload }
    } catch {
        return {
            decoded: null,
            res: NextResponse.json(
                { success: false, message: "Invalid token" },
                { status: 401 }
            ),
        }
    }
}

/**
 * Verifies an `Authorization: Bearer <jwt>` header for a sub-admin role.
 * Returns the authenticated user id on success, or a ready-to-return
 * 401/403 response on failure.
 */
export function requireSubAdminAuth(
    req: NextRequest,
    role: SubAdminRole
): AuthResult {
    const { decoded, res } = decodeBearerToken(req)
    if (!decoded) {
        return { ok: false, res: res! }
    }

    if (decoded.role !== role) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid role" },
                { status: 403 }
            ),
        }
    }

    if (typeof decoded.id !== "string" || !decoded.id) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid token payload" },
                { status: 401 }
            ),
        }
    }

    return { ok: true, userId: decoded.id, role }
}

export function requireAnySubAdminAuth(req: NextRequest): AuthResult {
    const { decoded, res } = decodeBearerToken(req)
    if (!decoded) {
        return { ok: false, res: res! }
    }

    const role = decoded.role as SubAdminRole
    if (role !== "state" && role !== "asm" && role !== "branch") {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid role" },
                { status: 403 }
            ),
        }
    }

    if (typeof decoded.id !== "string" || !decoded.id) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid token payload" },
                { status: 401 }
            ),
        }
    }

    return { ok: true, userId: decoded.id, role }
}
