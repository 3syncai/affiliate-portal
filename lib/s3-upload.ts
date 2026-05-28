import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

// Use environment variables
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || ""
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || ""
const S3_REGION_NAME = process.env.S3_REGION || "ap-south-1"
const S3_BUCKET_NAME = process.env.S3_BUCKET || "oweg-product-images"

export const s3Client = new S3Client({
    region: S3_REGION_NAME,
    credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
    },
})

export const S3_BUCKET = S3_BUCKET_NAME
export const S3_URL_PREFIX = `https://${S3_BUCKET_NAME}.s3.${S3_REGION_NAME}.amazonaws.com/`

export async function uploadToS3(
    file: File,
    folder: string,
    filename: string
): Promise<string> {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const key = `${folder}/${filename}`

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
    })

    await s3Client.send(command)

    // Return the S3 URL
    return `${S3_URL_PREFIX}${key}`
}

/**
 * Best-effort delete used to clean up orphaned uploads when a subsequent
 * step in the request fails (second upload errored, DB UPDATE rolled back,
 * etc.). Accepts either a full https URL returned by `uploadToS3` or a
 * bare bucket key. Never throws — failures are logged so the caller can
 * still surface the original error to the client.
 */
export async function deleteFromS3(urlOrKey: string): Promise<void> {
    const key = urlOrKey.startsWith(S3_URL_PREFIX)
        ? urlOrKey.slice(S3_URL_PREFIX.length)
        : urlOrKey
    if (!key) return
    try {
        await s3Client.send(
            new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key })
        )
    } catch (err) {
        console.error(`[s3] Failed to delete ${key}:`, err)
    }
}

/**
 * Upload affiliate documents to S3
 * @param file - The file to upload
 * @param username - The affiliate's username/email
 * @param docType - Type of document ('aadhar' or 'pancard')
 * @returns S3 URL of the uploaded file
 */
export async function uploadAffiliateDocument(
    file: File,
    username: string,
    docType: "aadhar" | "pancard"
): Promise<string> {
    const folder = `affiliate/${username}`
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `${docType}.${extension}`

    return uploadToS3(file, folder, filename)
}

export type SubAdminLevel = "state_admin" | "branch_head" | "asm"

/**
 * Single source of truth for the S3 folder a sub-admin's KYC documents
 * live in. Used by both uploads (`uploadSubAdminDocument`,
 * `uploadSubAdminDocumentReplacement`) AND the one-shot migration script
 * (`scripts/migrate-kyc-s3.ts`) so the two always agree on the layout.
 *
 * Layout: `affiliate/agent_detail/{level}/{sanitized-name}_{shortId}`
 *
 * Hybrid scheme — readable AND collision-safe:
 *   - The sanitised name keeps the folder human-readable in the S3 console.
 *   - The 8-char user-id suffix guarantees uniqueness even when two agents
 *     have names that sanitise to the same string (e.g. "John@Doe",
 *     "John-Doe" and "John Doe" all collapse to "john-doe", but their UUID
 *     suffixes differ).
 *
 * Sanitisation: lower-case, replace any run of non `[a-z0-9]` with a dash,
 * trim leading/trailing dashes, fall back to `"agent"` if the result is
 * empty. The short id is the first 8 hex chars of the UUID with dashes
 * removed (so a v4 UUID `a3f8c2b1-4e5d-49f7-9c3d-...` becomes `a3f8c2b1`).
 */
export function buildSubAdminFolder(
    level: SubAdminLevel,
    agentName: string,
    userId: string
): string {
    if (!userId) {
        throw new Error("buildSubAdminFolder: userId is required")
    }
    const sanitized =
        (agentName || "agent")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "agent"
    const shortId = userId.replace(/-/g, "").slice(0, 8)
    return `affiliate/agent_detail/${level}/${sanitized}_${shortId}`
}

/**
 * Upload sub-admin (state/branch_head/asm) KYC documents to S3.
 *
 * Path layout: `affiliate/agent_detail/{level}/{sanitized-name}_{shortId}/{docType}.{ext}`
 *
 * See `buildSubAdminFolder` for the rationale behind the hybrid name+id
 * folder scheme.
 */
export async function uploadSubAdminDocument(
    file: File,
    level: SubAdminLevel,
    agentName: string,
    userId: string,
    docType: "aadhar" | "pancard"
): Promise<string> {
    const folder = buildSubAdminFolder(level, agentName, userId)
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase()
    const filename = `${docType}.${extension}`

    return uploadToS3(file, folder, filename)
}

/**
 * Upload a *replacement* sub-admin KYC document to S3, preserving the prior
 * version as history.
 *
 * Path layout: `affiliate/agent_detail/{level}/{sanitized-name}_{shortId}/{docType}_updated{versionIndex}.{ext}`
 *
 * Unlike `uploadSubAdminDocument`, this helper is the only path used by the
 * KYC edit endpoint and intentionally lives in the same folder as the
 * onboarding upload. The version suffix guarantees a unique S3 key per
 * re-upload, so:
 *   - the original onboarding file (`{docType}.{ext}`) is never overwritten,
 *   - prior `{docType}_updated{n}.{ext}` files are also never overwritten,
 *   - cleanup-on-failure can safely delete the new file because no other
 *     row could already be pointing at this brand-new key.
 *
 * The caller (`handleSubAdminKycEdit`) computes `versionIndex` by parsing
 * the URL currently stored in the DB column — see `nextReplacementIndex`.
 */
export async function uploadSubAdminDocumentReplacement(
    file: File,
    level: SubAdminLevel,
    agentName: string,
    userId: string,
    docType: "aadhar" | "pancard",
    versionIndex: number
): Promise<string> {
    if (!Number.isInteger(versionIndex) || versionIndex < 1) {
        throw new Error(
            "uploadSubAdminDocumentReplacement: versionIndex must be a positive integer"
        )
    }
    const folder = buildSubAdminFolder(level, agentName, userId)
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase()
    const filename = `${docType}_updated${versionIndex}.${extension}`

    return uploadToS3(file, folder, filename)
}
