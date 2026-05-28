import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

// Use environment variables
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || ""
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || ""
const S3_REGION_NAME = process.env.S3_REGION || "ap-south-1"
const S3_BUCKET_NAME = process.env.S3_BUCKET || "oweg-product-images"

const s3Client = new S3Client({
    region: S3_REGION_NAME,
    credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
    },
})

const S3_URL_PREFIX = `https://${S3_BUCKET_NAME}.s3.${S3_REGION_NAME}.amazonaws.com/`

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
 * Upload sub-admin (state/branch_head/asm) KYC documents to S3.
 *
 * Path layout: `affiliate/agent_detail/{level}/{userId}/{docType}.{ext}`
 *
 * We deliberately use the immutable user id rather than a sanitised
 * first/last name. Name-derived paths had two problems:
 *
 *   1. Different agents whose names sanitised to the same string would
 *      collide and overwrite each other's documents (e.g. "John@Doe",
 *      "John-Doe" and "John Doe" all collapsed to "john-doe").
 *   2. If an agent ever renamed themselves, their previously uploaded
 *      docs would become unreachable orphans.
 *
 * The user id is a stable UUID so neither failure mode applies.
 */
export async function uploadSubAdminDocument(
    file: File,
    level: SubAdminLevel,
    userId: string,
    docType: "aadhar" | "pancard"
): Promise<string> {
    if (!userId) {
        throw new Error("uploadSubAdminDocument: userId is required")
    }
    const folder = `affiliate/agent_detail/${level}/${userId}`
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase()
    const filename = `${docType}.${extension}`

    return uploadToS3(file, folder, filename)
}

/**
 * Upload a *replacement* sub-admin KYC document to S3, preserving the prior
 * version as history.
 *
 * Path layout: `affiliate/agent_detail/{level}/{userId}/{docType}_updated{versionIndex}.{ext}`
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
    userId: string,
    docType: "aadhar" | "pancard",
    versionIndex: number
): Promise<string> {
    if (!userId) {
        throw new Error("uploadSubAdminDocumentReplacement: userId is required")
    }
    if (!Number.isInteger(versionIndex) || versionIndex < 1) {
        throw new Error(
            "uploadSubAdminDocumentReplacement: versionIndex must be a positive integer"
        )
    }
    const folder = `affiliate/agent_detail/${level}/${userId}`
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase()
    const filename = `${docType}_updated${versionIndex}.${extension}`

    return uploadToS3(file, folder, filename)
}
