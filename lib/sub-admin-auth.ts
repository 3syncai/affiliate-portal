import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "@/lib/env"

export type SubAdminRole = "asm" | "branch" | "state"

type AuthSuccess = { ok: true; userId: string }
type AuthFailure = { ok: false; res: NextResponse }
export type AuthResult = AuthSuccess | AuthFailure

/**
 * Verifies an `Authorization: Bearer <jwt>` header for a sub-admin role.
 * Returns the authenticated user id on success, or a ready-to-return
 * 401/403 response on failure.
 *
 * The signing secret is loaded via `getJwtSecret()` which throws if
 * `JWT_SECRET` is unset — that surfaces as a 500 in the route's catch
 * block instead of silently accepting tokens signed with a default.
 */
export function requireSubAdminAuth(
    req: NextRequest,
    role: SubAdminRole
): AuthResult {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            ),
        }
    }

    const token = authHeader.split(" ")[1]
    let decoded: any
    try {
        decoded = jwt.verify(token, getJwtSecret())
    } catch {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid token" },
                { status: 401 }
            ),
        }
    }

    if (decoded?.role !== role) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid role" },
                { status: 403 }
            ),
        }
    }

    if (typeof decoded?.id !== "string" || !decoded.id) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Invalid token payload" },
                { status: 401 }
            ),
        }
    }

    return { ok: true, userId: decoded.id }
}
