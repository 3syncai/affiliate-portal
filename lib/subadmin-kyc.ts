import type { Pool } from "pg"
import { NextRequest, NextResponse } from "next/server"
import { ensureInitialPasswordResetSchema } from "@/lib/auth/initial-password-reset"
import {
    normalizeAadhar,
    normalizePan,
    validateKycNumbers,
} from "@/lib/kyc-validation"
import {
    uploadSubAdminDocument,
    uploadSubAdminDocumentReplacement,
    deleteFromS3,
    type SubAdminLevel,
} from "@/lib/s3-upload"

const SUBADMIN_TABLES = [
    "state_admin",
    "area_sales_manager",
    "branch_admin",
] as const

export type SubAdminTable = (typeof SUBADMIN_TABLES)[number]

let schemaEnsured = false

/**
 * Idempotent schema bootstrapper. Kept for explicit migration tooling and
 * dev bootstrap scripts that need to provision a fresh database, but it
 * is NO LONGER invoked from request paths. Production routes must rely on
 * `migrations/add_subadmin_kyc.sql` having been applied during deployment.
 * Running DDL from a GET handler made the request depend on table-level
 * locks and DDL privileges and could turn a routine fetch into a 500.
 *
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

// Note: userId is intentionally NOT in this list. It comes from the JWT,
// not from client-supplied form data, so untrusted callers cannot overwrite
// arbitrary sub-admin profiles.
const REQUIRED_TEXT_FIELDS = [
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
    /** Authenticated user id derived from a verified JWT — NEVER from request body. */
    authUserId: string
    /** SELECT list returned in the response. Caller controls which role-specific columns to surface. */
    returningColumns: string
    logPrefix: string
}

/**
 * Shared multipart handler for POST /api/{state-admin|asm|branch}/complete-profile.
 *
 * Responsibilities:
 *   1. Validate required text fields.
 *   2. Confirm the authenticated user actually exists in the target table.
 *   3. Upload PAN + Aadhar to S3 under a path keyed by the immutable user id.
 *   4. Persist all fields and flip `profile_completed = TRUE`.
 *
 * Failure handling:
 *   If any step after the first successful S3 upload fails (second upload
 *   errors, DB UPDATE rolls back, etc.) we best-effort delete every file we
 *   already uploaded so abandoned objects don't accumulate in the bucket.
 *   S3 cleanup errors are logged but never surfaced to the client — the
 *   original failure is what the caller needs to know about.
 */
export async function handleCompleteSubAdminProfile(
    req: NextRequest,
    options: CompleteProfileOptions
): Promise<NextResponse> {
    const { pool, table, s3Level, authUserId, returningColumns, logPrefix } = options
    const uploadedUrls: string[] = []

    try {
        await ensureInitialPasswordResetSchema()

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

        values.pan_card_no = normalizePan(values.pan_card_no)
        values.aadhar_card_no = normalizeAadhar(values.aadhar_card_no)

        const kycError = validateKycNumbers(
            values.pan_card_no,
            values.aadhar_card_no,
        )
        if (kycError) {
            return NextResponse.json(
                { success: false, message: kycError },
                { status: 400 },
            )
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
            [authUserId]
        )
        if (userRes.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Account not found" },
                { status: 404 }
            )
        }
        const agentName = composeAgentName(
            userRes.rows[0].first_name,
            userRes.rows[0].last_name
        )

        let panUrl: string
        let aadharUrl: string
        try {
            panUrl = await uploadSubAdminDocument(
                panFile,
                s3Level,
                agentName,
                authUserId,
                "pancard"
            )
            uploadedUrls.push(panUrl)
        } catch (err: any) {
            console.error(`${logPrefix} PAN upload failed`, err)
            return NextResponse.json(
                { success: false, message: "Failed to upload PAN card photo", error: err?.message },
                { status: 500 }
            )
        }
        try {
            aadharUrl = await uploadSubAdminDocument(
                aadharFile,
                s3Level,
                agentName,
                authUserId,
                "aadhar"
            )
            uploadedUrls.push(aadharUrl)
        } catch (err: any) {
            console.error(`${logPrefix} Aadhar upload failed`, err)
            await cleanupUploads(uploadedUrls, logPrefix)
            return NextResponse.json(
                { success: false, message: "Failed to upload Aadhar card photo", error: err?.message },
                { status: 500 }
            )
        }

        try {
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
                    authUserId,
                ]
            )

            if (updateRes.rows.length === 0) {
                // Row vanished between the existence check and the UPDATE.
                // Treat as a partial failure and clean up the S3 files.
                await cleanupUploads(uploadedUrls, logPrefix)
                return NextResponse.json(
                    { success: false, message: "Account not found" },
                    { status: 404 }
                )
            }

            return NextResponse.json({
                success: true,
                message: "Profile completed successfully",
                user: updateRes.rows[0],
            })
        } catch (dbErr: any) {
            console.error(`${logPrefix} UPDATE failed`, dbErr)
            await cleanupUploads(uploadedUrls, logPrefix)
            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to save profile",
                    error: dbErr?.message,
                },
                { status: 500 }
            )
        }
    } catch (err: any) {
        console.error(`${logPrefix} failed`, err)
        await cleanupUploads(uploadedUrls, logPrefix)
        return NextResponse.json(
            { success: false, message: "Failed to complete profile", error: err?.message },
            { status: 500 }
        )
    }
}

async function cleanupUploads(urls: string[], logPrefix: string): Promise<void> {
    if (urls.length === 0) return
    console.warn(`${logPrefix} cleaning up ${urls.length} orphaned S3 object(s)`)
    await Promise.all(urls.map((url) => deleteFromS3(url)))
}

/**
 * Build the "agent name" passed to `buildSubAdminFolder` from the
 * first/last name columns on the sub-admin row. Either or both may be
 * NULL on legacy rows; we coerce nulls to empty strings and rely on
 * `buildSubAdminFolder`'s `"agent"` fallback when both are blank.
 */
function composeAgentName(firstName: unknown, lastName: unknown): string {
    const first = typeof firstName === "string" ? firstName : ""
    const last = typeof lastName === "string" ? lastName : ""
    return `${first} ${last}`.trim()
}

type KycEditOptions = {
    pool: Pool
    table: SubAdminTable
    s3Level: SubAdminLevel
    /** Authenticated user id derived from a verified JWT — NEVER from request body. */
    authUserId: string
    /** SELECT list returned in the response. Match the role's me-route shape so the client can swap state directly. */
    returningColumns: string
    logPrefix: string
}

/**
 * PATCH handler for /api/{state-admin|asm|branch}/kyc.
 *
 * Lets an already-onboarded sub-admin update their PAN/Aadhar numbers, and
 * optionally replace one or both photo files. The PAN/Aadhar numbers are
 * required and cannot be blanked. The photo files are optional — leaving
 * the file picker empty keeps whatever URL is already in the DB.
 *
 * Cleanup pattern is more nuanced than the create-flow because the S3 path
 * is keyed by `{userId}/{docType}.{ext}`. A same-extension re-upload
 * atomically overwrites the previous object at the same key; if the DB
 * UPDATE then fails, deleting that new object would orphan the URL the DB
 * still references. We therefore only delete uploads whose URL differs
 * from the prior column value.
 */
export async function handleSubAdminKycEdit(
    req: NextRequest,
    options: KycEditOptions
): Promise<NextResponse> {
    const { pool, table, s3Level, authUserId, returningColumns, logPrefix } = options
    const uploadedUrls: string[] = []

    try {
        const formData = await req.formData()

        const panNoRaw = formData.get("pan_card_no")
        const aadharNoRaw = formData.get("aadhar_card_no")
        const panNo = normalizePan(typeof panNoRaw === "string" ? panNoRaw : "")
        const aadharNo = normalizeAadhar(
            typeof aadharNoRaw === "string" ? aadharNoRaw : "",
        )

        if (!panNo) {
            return NextResponse.json(
                { success: false, message: "PAN card number is required" },
                { status: 400 }
            )
        }
        if (!aadharNo) {
            return NextResponse.json(
                { success: false, message: "Aadhar card number is required" },
                { status: 400 }
            )
        }

        const kycValidationError = validateKycNumbers(panNo, aadharNo)
        if (kycValidationError) {
            return NextResponse.json(
                { success: false, message: kycValidationError },
                { status: 400 }
            )
        }

        const panFile = formData.get("pan_card_photo")
        const aadharFile = formData.get("aadhar_card_photo")
        const hasPanReplacement = panFile instanceof File && panFile.size > 0
        const hasAadharReplacement = aadharFile instanceof File && aadharFile.size > 0

        // Look up the existing photo URLs so cleanup-on-failure can decide
        // whether a freshly-uploaded object would orphan the URL the DB
        // still points to. Also confirms the authenticated row exists and
        // gives us the name we need for the hybrid S3 folder.
        const existingRes = await pool.query(
            `SELECT first_name, last_name, pan_card_photo, aadhar_card_photo
             FROM ${table} WHERE id = $1`,
            [authUserId]
        )
        if (existingRes.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Account not found" },
                { status: 404 }
            )
        }
        const agentName = composeAgentName(
            existingRes.rows[0].first_name,
            existingRes.rows[0].last_name
        )
        const oldPanUrl: string | null = existingRes.rows[0].pan_card_photo ?? null
        const oldAadharUrl: string | null = existingRes.rows[0].aadhar_card_photo ?? null

        let newPanUrl: string | null = null
        let newAadharUrl: string | null = null

        if (hasPanReplacement) {
            try {
                const panIndex = nextReplacementIndex(oldPanUrl, "pancard")
                newPanUrl = await uploadSubAdminDocumentReplacement(
                    panFile as File,
                    s3Level,
                    agentName,
                    authUserId,
                    "pancard",
                    panIndex
                )
                uploadedUrls.push(newPanUrl)
            } catch (err: any) {
                console.error(`${logPrefix} PAN upload failed`, err)
                return NextResponse.json(
                    { success: false, message: "Failed to upload PAN card photo", error: err?.message },
                    { status: 500 }
                )
            }
        }

        if (hasAadharReplacement) {
            try {
                const aadharIndex = nextReplacementIndex(oldAadharUrl, "aadhar")
                newAadharUrl = await uploadSubAdminDocumentReplacement(
                    aadharFile as File,
                    s3Level,
                    agentName,
                    authUserId,
                    "aadhar",
                    aadharIndex
                )
                uploadedUrls.push(newAadharUrl)
            } catch (err: any) {
                console.error(`${logPrefix} Aadhar upload failed`, err)
                await cleanupReplacementUploads(
                    [{ newUrl: newPanUrl, oldUrl: oldPanUrl }],
                    logPrefix
                )
                return NextResponse.json(
                    { success: false, message: "Failed to upload Aadhar card photo", error: err?.message },
                    { status: 500 }
                )
            }
        }

        // Build the dynamic SET clause. Numbers are always updated; photos
        // only when a fresh URL was produced.
        const setClauses: string[] = [
            "pan_card_no = $1",
            "aadhar_card_no = $2",
        ]
        const params: unknown[] = [panNo, aadharNo]
        let idx = 3
        if (newPanUrl) {
            setClauses.push(`pan_card_photo = $${idx++}`)
            params.push(newPanUrl)
        }
        if (newAadharUrl) {
            setClauses.push(`aadhar_card_photo = $${idx++}`)
            params.push(newAadharUrl)
        }
        setClauses.push("updated_at = NOW()")
        params.push(authUserId)

        try {
            const updateRes = await pool.query(
                `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING ${returningColumns}`,
                params
            )

            if (updateRes.rows.length === 0) {
                await cleanupReplacementUploads(
                    [
                        { newUrl: newPanUrl, oldUrl: oldPanUrl },
                        { newUrl: newAadharUrl, oldUrl: oldAadharUrl },
                    ],
                    logPrefix
                )
                return NextResponse.json(
                    { success: false, message: "Account not found" },
                    { status: 404 }
                )
            }

            return NextResponse.json({
                success: true,
                message: "KYC details updated successfully",
                user: updateRes.rows[0],
            })
        } catch (dbErr: any) {
            console.error(`${logPrefix} UPDATE failed`, dbErr)
            await cleanupReplacementUploads(
                [
                    { newUrl: newPanUrl, oldUrl: oldPanUrl },
                    { newUrl: newAadharUrl, oldUrl: oldAadharUrl },
                ],
                logPrefix
            )
            return NextResponse.json(
                { success: false, message: "Failed to save KYC details", error: dbErr?.message },
                { status: 500 }
            )
        }
    } catch (err: any) {
        console.error(`${logPrefix} failed`, err)
        // Outer-catch can't know which uploads to safely delete (we lost
        // the oldUrl context if SELECT failed). Best-effort wipe any URL
        // we already collected; same-key collisions are tolerated.
        await cleanupUploads(uploadedUrls, logPrefix)
        return NextResponse.json(
            { success: false, message: "Failed to update KYC", error: err?.message },
            { status: 500 }
        )
    }
}

/**
 * Compute the next version index for a versioned KYC re-upload, based on
 * the URL currently stored in the DB column.
 *
 * Naming convention (see `uploadSubAdminDocument` and
 * `uploadSubAdminDocumentReplacement` in `lib/s3-upload.ts`):
 *   - Onboarding file:    `{docType}.{ext}`              → next = 1
 *   - 1st re-upload:      `{docType}_updated1.{ext}`     → next = 2
 *   - Nth re-upload:      `{docType}_updated{N}.{ext}`   → next = N + 1
 *   - Missing/unknown:                                    → next = 1
 *
 * Falling back to 1 on legacy / unrecognised naming is safe because
 * `_updated1.{ext}` is itself a guaranteed-new key (no overwrite risk).
 */
function nextReplacementIndex(
    currentUrl: string | null,
    docType: "aadhar" | "pancard"
): number {
    if (!currentUrl) return 1
    const basename = currentUrl.split("/").pop() || ""
    const dotIdx = basename.lastIndexOf(".")
    const stem = dotIdx > 0 ? basename.slice(0, dotIdx) : basename
    if (stem === docType) return 1
    const match = stem.match(new RegExp(`^${docType}_updated(\\d+)$`))
    if (match) {
        const parsed = parseInt(match[1], 10)
        if (Number.isFinite(parsed) && parsed >= 1) return parsed + 1
    }
    return 1
}

/**
 * Same-key-aware cleanup helper for the edit flow. Only deletes URLs whose
 * key differs from the one the DB previously pointed at — otherwise the
 * "new" object IS the canonical store for that path and deleting it would
 * orphan the column.
 *
 * With the versioned `_updated{n}` filename scheme, every re-upload key is
 * guaranteed to differ from the prior column value, so this check now
 * always passes for replacements — the filter is kept defensively in case
 * a future caller reuses the helper with an overwrite-style upload.
 */
async function cleanupReplacementUploads(
    pairs: { newUrl: string | null; oldUrl: string | null }[],
    logPrefix: string
): Promise<void> {
    const toDelete = pairs
        .filter((p) => p.newUrl && p.newUrl !== p.oldUrl)
        .map((p) => p.newUrl as string)
    if (toDelete.length === 0) return
    console.warn(`${logPrefix} cleaning up ${toDelete.length} replacement upload(s)`)
    await Promise.all(toDelete.map((url) => deleteFromS3(url)))
}
