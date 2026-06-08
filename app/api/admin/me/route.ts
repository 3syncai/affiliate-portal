import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import pool from "@/lib/db"
import { getJwtSecret } from "@/lib/env"

export const dynamic = "force-dynamic"

function requireAdminAuth(req: NextRequest) {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
        return {
            ok: false as const,
            res: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
        }
    }

    try {
        const decoded = jwt.verify(authHeader.split(" ")[1], getJwtSecret()) as {
            id?: string
            role?: string
        }

        if (decoded.role !== "admin" || !decoded.id) {
            return {
                ok: false as const,
                res: NextResponse.json({ success: false, message: "Invalid role" }, { status: 403 }),
            }
        }

        return { ok: true as const, userId: decoded.id }
    } catch {
        return {
            ok: false as const,
            res: NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 }),
        }
    }
}

function mapAdminUser(row: {
    id: string
    name: string | null
    email: string
    phone: string | null
    created_at?: string | Date | null
}) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: "admin",
        designation: "National Head",
        created_at: row.created_at ?? null,
    }
}

function normalizePhone(value: unknown): string | null {
    if (typeof value !== "string") return null
    const digits = value.replace(/\D/g, "").slice(0, 10)
    return digits.length === 10 ? digits : null
}

export async function GET(req: NextRequest) {
    const auth = requireAdminAuth(req)
    if (!auth.ok) return auth.res

    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, created_at
             FROM affiliate_admin
             WHERE id = $1`,
            [auth.userId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            user: mapAdminUser(result.rows[0]),
        })
    } catch (error) {
        console.error("Failed to fetch admin profile:", error)
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Failed to fetch profile",
            },
            { status: 500 }
        )
    }
}

export async function PATCH(req: NextRequest) {
    const auth = requireAdminAuth(req)
    if (!auth.ok) return auth.res

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    }

    const allowedFields = new Set(["phone"])
    for (const key of Object.keys(body)) {
        if (!allowedFields.has(key)) {
            return NextResponse.json(
                { success: false, message: `Field '${key}' cannot be updated from this endpoint` },
                { status: 400 }
            )
        }
    }

    if (body.phone === undefined) {
        return NextResponse.json(
            { success: false, message: "No updatable fields supplied" },
            { status: 400 }
        )
    }

    const phone = normalizePhone(body.phone)
    if (!phone) {
        return NextResponse.json(
            { success: false, message: "Phone number must be a valid 10-digit mobile number" },
            { status: 400 }
        )
    }

    try {
        const result = await pool.query(
            `UPDATE affiliate_admin
             SET phone = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, email, phone, created_at`,
            [phone, auth.userId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            message: "Mobile number saved",
            user: mapAdminUser(result.rows[0]),
        })
    } catch (error) {
        console.error("Failed to update admin profile:", error)
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Failed to update profile",
            },
            { status: 500 }
        )
    }
}
