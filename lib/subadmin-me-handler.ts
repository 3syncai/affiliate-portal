import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { getDatabaseUrl } from "@/lib/env"
import { requireSubAdminAuth, type SubAdminRole } from "@/lib/sub-admin-auth"

/**
 * Shared GET + PATCH handlers for /api/{state-admin,asm,branch}/me.
 *
 * The original per-role files duplicated:
 *   - JWT verification + role check
 *   - Pool construction with the unsafe NEXT_PUBLIC_DATABASE_URL fallback
 *   - PROTECTED_FIELDS / BANK_FIELDS lists
 *   - "reject unknown keys" loop (was missing in two of three routes)
 *   - The dynamic SET clause builder
 *
 * Now centralised here. Each role-specific route just supplies its
 * table name, role string, and SELECT column list.
 */

const BANK_FIELDS = [
    "account_name",
    "bank_name",
    "bank_branch",
    "ifsc_code",
    "account_number",
] as const

export type BankField = (typeof BANK_FIELDS)[number]
const BANK_FIELD_SET: ReadonlySet<string> = new Set(BANK_FIELDS)

export type SubAdminTable = "state_admin" | "area_sales_manager" | "branch_admin"

export type SubAdminMeOptions = {
    role: SubAdminRole
    table: SubAdminTable
    /** Raw SELECT column list (already coerced to project shape, including COALESCE for profile_completed). */
    selectColumns: string
}

function makePool(): Pool {
    return new Pool({
        connectionString: getDatabaseUrl(),
        ssl: { rejectUnauthorized: false },
    })
}

export async function handleSubAdminMeGet(
    req: NextRequest,
    options: SubAdminMeOptions
): Promise<NextResponse> {
    const auth = requireSubAdminAuth(req, options.role)
    if (!auth.ok) return auth.res

    let pool: Pool | undefined
    try {
        pool = makePool()
        const result = await pool.query(
            `SELECT ${options.selectColumns} FROM ${options.table} WHERE id = $1`,
            [auth.userId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, user: result.rows[0] })
    } catch (error: any) {
        console.error(`[${options.role}/me:GET] failed:`, error)
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to load profile" },
            { status: 500 }
        )
    } finally {
        await pool?.end().catch((endError) => {
            console.error(`[${options.role}/me:GET] pool.end failed:`, endError)
        })
    }
}

export async function handleSubAdminMePatch(
    req: NextRequest,
    options: SubAdminMeOptions
): Promise<NextResponse> {
    const auth = requireSubAdminAuth(req, options.role)
    if (!auth.ok) return auth.res

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        )
    }

    // Reject any key that isn't an explicit bank field. This both blocks
    // KYC/identity overwrites (the old PROTECTED_FIELDS allowlist) and
    // unknown keys (e.g. "foo") that the previous implementation silently
    // accepted into the build loop.
    for (const key of Object.keys(body)) {
        if (!BANK_FIELD_SET.has(key)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Field '${key}' cannot be updated from this endpoint`,
                },
                { status: 400 }
            )
        }
    }

    const updates: Partial<Record<BankField, string>> = {}
    for (const field of BANK_FIELDS) {
        const raw = body[field]
        if (raw === undefined) continue
        const value = typeof raw === "string" ? raw.trim() : ""
        if (!value) {
            return NextResponse.json(
                { success: false, message: `Field '${field}' cannot be empty` },
                { status: 400 }
            )
        }
        updates[field] = value
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json(
            { success: false, message: "No bank fields supplied" },
            { status: 400 }
        )
    }

    let pool: Pool | undefined
    try {
        pool = makePool()

        const setClauses: string[] = []
        const values: unknown[] = []
        let idx = 1
        for (const [field, value] of Object.entries(updates)) {
            setClauses.push(`${field} = $${idx++}`)
            values.push(value)
        }
        setClauses.push(`updated_at = NOW()`)
        values.push(auth.userId)

        const result = await pool.query(
            `UPDATE ${options.table} SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING ${options.selectColumns}`,
            values
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Bank details updated successfully",
            user: result.rows[0],
        })
    } catch (error: any) {
        console.error(`[${options.role}/me:PATCH] failed:`, error)
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to update bank details" },
            { status: 500 }
        )
    } finally {
        await pool?.end().catch((endError) => {
            console.error(`[${options.role}/me:PATCH] pool.end failed:`, endError)
        })
    }
}
