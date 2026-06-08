import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import {
    getDebugControllerId,
    getDebugControllerPassword,
    getDebugControllerSecret,
} from "@/lib/env"

export const DEBUG_SESSION_COOKIE = "debug_controller_session"

type AuthSuccess = { ok: true }
type AuthFailure = { ok: false; res: NextResponse }
export type DebugAuthResult = AuthSuccess | AuthFailure

export function verifyDebugCredentials(id: string, password: string): boolean {
    return id === getDebugControllerId() && password === getDebugControllerPassword()
}

export function createDebugSessionToken(): string {
    return jwt.sign(
        { role: "debug_controller", iat: Math.floor(Date.now() / 1000) },
        getDebugControllerSecret(),
        { expiresIn: "8h" }
    )
}

export function requireDebugAuth(req: NextRequest): DebugAuthResult {
    const token = req.cookies.get(DEBUG_SESSION_COOKIE)?.value

    if (!token) {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            ),
        }
    }

    try {
        const decoded = jwt.verify(token, getDebugControllerSecret()) as {
            role?: string
        }
        if (decoded.role !== "debug_controller") {
            throw new Error("Invalid role")
        }
    } catch {
        return {
            ok: false,
            res: NextResponse.json(
                { success: false, message: "Session expired" },
                { status: 401 }
            ),
        }
    }

    return { ok: true }
}

export function setDebugSessionCookie(res: NextResponse, token: string): void {
    res.cookies.set(DEBUG_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8,
    })
}

export function clearDebugSessionCookie(res: NextResponse): void {
    res.cookies.set(DEBUG_SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    })
}
