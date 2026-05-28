import type { Pool } from "pg"
import { NextRequest, NextResponse } from "next/server"
import { uploadSubAdminDocument, type SubAdminLevel } from "@/lib/s3-upload"

const SUBADMIN_TABLES = [
    "state_admin",
    "area_sales_manager",
    "branch_admin",
] as const

export type SubAdminTable = (typeof SUBADMIN_TABLES)[number]

let schemaEnsured = false

/**
 * Lazy migration runner mirrors `ensureAdditionalCommissionSchema` in
 * lib/additional-commission.ts. Runs once per Node process so the
 * complete-profile flow works on a fresh checkout without manual psql steps.
 * Source of truth: migrations/add_subadmin_kyc.sql
 */
export async function ensureSubAdminKycSchema(pool: Pool): Promise<void> {
    if (schemaEnsured) return

    for (const table of SUBADMIN_TABLES) {
        await pool.query(`
            ALTER TABLE ${table}
                ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS pan_card_no VARCHAR(20),
                ADD COLUMN IF NOT EXISTS pan_card_photo TEXT,
                ADD COLUMN IF NOT EXISTS aadhar_card_no VARCHAR(20),
                ADD COLUMN IF NOT EXISTS aadhar_card_photo TEXT,
                ADD COLUMN IF NOT EXISTS account_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255),
                ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
                ADD COLUMN IF NOT EXISTS account_number VARCHAR(50)
        `)
    }

    schemaEnsured = true
}

const REQUIRED_TEXT_FIELDS = [
    "userId",
    "pan_card_no",
    "aadhar_card_no",
    "account_name",
    "bank_name",
    "bank_branch",
    "ifsc_code",
    "account_number",
] as const

type CompleteProfileOptions = {
    pool: Pool
    table: SubAdminTable
    s3Level: SubAdminLevel
    /** SELECT list returned in the response. Caller controls which role-specific columns to surface. */
    returningColumns: string
    logPrefix: string
}

/**
 * Shared multipart handler for POST /api/{state-admin|asm|branch}/complete-profile.
 * Validates fields, uploads PAN + Aadhar to S3, persists everything, flips
 * profile_completed = TRUE. Returns the freshly updated user row.
 */
export async function handleCompleteSubAdminProfile(
    req: NextRequest,
    options: CompleteProfileOptions
): Promise<NextResponse> {
    const { pool, table, s3Level, returningColumns, logPrefix } = options
    try {
        await ensureSubAdminKycSchema(pool)

        const formData = await req.formData()

        const values: Record<string, string> = {}
        for (const field of REQUIRED_TEXT_FIELDS) {
            const raw = formData.get(field)
            const value = typeof raw === "string" ? raw.trim() : ""
            if (!value) {
                return NextResponse.json(
                    { success: false, message: `Missing required field: ${field}` },
                    { status: 400 }
                )
            }
            values[field] = value
        }

        const panFile = formData.get("pan_card_photo")
        const aadharFile = formData.get("aadhar_card_photo")

        if (!(panFile instanceof File) || panFile.size === 0) {
            return NextResponse.json(
                { success: false, message: "PAN card photo is required" },
                { status: 400 }
            )
        }
        if (!(aadharFile instanceof File) || aadharFile.size === 0) {
            return NextResponse.json(
                { success: false, message: "Aadhar card photo is required" },
                { status: 400 }
            )
        }

        const userRes = await pool.query(
            `SELECT id, first_name, last_name FROM ${table} WHERE id = $1`,
            [values.userId]
        )
        if (userRes.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Account not found" },
                { status: 404 }
            )
        }
        const existing = userRes.rows[0]
        const agentName =
            `${existing.first_name || ""}-${existing.last_name || ""}`.trim() ||
            existing.id

        let panUrl: string
        let aadharUrl: string
        try {
            panUrl = await uploadSubAdminDocument(panFile, s3Level, agentName, "pancard")
        } catch (err: any) {
            console.error(`${logPrefix} PAN upload failed`, err)
            return NextResponse.json(
                { success: false, message: "Failed to upload PAN card photo", error: err?.message },
                { status: 500 }
            )
        }
        try {
            aadharUrl = await uploadSubAdminDocument(aadharFile, s3Level, agentName, "aadhar")
        } catch (err: any) {
            console.error(`${logPrefix} Aadhar upload failed`, err)
            return NextResponse.json(
                { success: false, message: "Failed to upload Aadhar card photo", error: err?.message },
                { status: 500 }
            )
        }

        const updateRes = await pool.query(
            `UPDATE ${table} SET
                pan_card_no = $1,
                pan_card_photo = $2,
                aadhar_card_no = $3,
                aadhar_card_photo = $4,
                account_name = $5,
                bank_name = $6,
                bank_branch = $7,
                ifsc_code = $8,
                account_number = $9,
                profile_completed = TRUE,
                updated_at = NOW()
             WHERE id = $10
             RETURNING ${returningColumns}`,
            [
                values.pan_card_no,
                panUrl,
                values.aadhar_card_no,
                aadharUrl,
                values.account_name,
                values.bank_name,
                values.bank_branch,
                values.ifsc_code,
                values.account_number,
                values.userId,
            ]
        )

        return NextResponse.json({
            success: true,
            message: "Profile completed successfully",
            user: updateRes.rows[0],
        })
    } catch (err: any) {
        console.error(`${logPrefix} failed`, err)
        return NextResponse.json(
            { success: false, message: "Failed to complete profile", error: err?.message },
            { status: 500 }
        )
    }
}
