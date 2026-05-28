/* eslint-disable no-console */
/**
 * Migrate sub-admin KYC documents in S3 to the hybrid folder layout.
 *
 * Source layouts (anything we've shipped historically):
 *   - Pre-CodeRabbit:        affiliate/agent_detail/{level}/{sanitized-name}/{file}
 *   - PR #33 (UUID-only):    affiliate/agent_detail/{level}/{uuid}/{file}
 *
 * Target layout (matches `buildSubAdminFolder` in lib/s3-upload.ts):
 *   - Hybrid:                affiliate/agent_detail/{level}/{sanitized-name}_{shortId}/{file}
 *
 * For each row in {state_admin, area_sales_manager, branch_admin} whose
 * pan_card_photo or aadhar_card_photo is non-NULL, we:
 *   1. Parse the existing S3 key from the stored URL.
 *   2. Compute the target key from (level, first_name+last_name, id).
 *   3. If the key already matches the target, skip (idempotent).
 *   4. Otherwise, in --apply mode:
 *        a. CopyObject  old -> new (S3)
 *        b. UPDATE table SET <column> = '<new-url>' WHERE id = '<id>'  (DB)
 *        c. DeleteObject old (S3)
 *      If (a) or (b) fails, we abort that row WITHOUT deleting the old
 *      object, so the DB never ends up pointing at a missing file.
 *
 * Usage:
 *   node scripts/migrate_kyc_s3.js                # dry-run (default)
 *   node scripts/migrate_kyc_s3.js --apply        # actually mutate S3 + DB
 *
 * Env required (read from .env or shell):
 *   DATABASE_URL          (or NEXT_PUBLIC_DATABASE_URL)
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_REGION             (default ap-south-1)
 *   S3_BUCKET             (default oweg-product-images)
 */

const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")
const {
    S3Client,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} = require("@aws-sdk/client-s3")

// ──────────────────────────────────────────────────────────────────────
// .env loader — same pattern as the other scripts in this folder
// ──────────────────────────────────────────────────────────────────────
function readDotEnv() {
    const envPath = path.join(__dirname, "..", ".env")
    const out = {}
    if (!fs.existsSync(envPath)) return out
    const text = fs.readFileSync(envPath, "utf8")
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith("#")) continue
        const eq = line.indexOf("=")
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim()
        let value = line.slice(eq + 1).trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        out[key] = value
    }
    return out
}

const dotEnv = readDotEnv()
for (const [k, v] of Object.entries(dotEnv)) {
    if (process.env[k] === undefined) process.env[k] = v
}

// ──────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply")
const DATABASE_URL =
    process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL || ""
const S3_REGION = process.env.S3_REGION || "ap-south-1"
const S3_BUCKET = process.env.S3_BUCKET || "oweg-product-images"
const S3_URL_PREFIX = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/`
const TABLE_TO_LEVEL = {
    state_admin: "state_admin",
    area_sales_manager: "branch_head",
    branch_admin: "asm",
}
const PHOTO_COLUMNS = ["pan_card_photo", "aadhar_card_photo"]

if (!DATABASE_URL) {
    console.error("ERROR: DATABASE_URL (or NEXT_PUBLIC_DATABASE_URL) must be set.")
    process.exit(2)
}
if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    console.error("ERROR: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set.")
    process.exit(2)
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
})

const s3 = new S3Client({
    region: S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
})

// ──────────────────────────────────────────────────────────────────────
// Hybrid folder builder — MUST stay in sync with
// `buildSubAdminFolder` in lib/s3-upload.ts.
// ──────────────────────────────────────────────────────────────────────
function buildSubAdminFolder(level, agentName, userId) {
    if (!userId) throw new Error("buildSubAdminFolder: userId is required")
    const sanitized =
        (agentName || "agent")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "agent"
    const shortId = String(userId).replace(/-/g, "").slice(0, 8)
    return `affiliate/agent_detail/${level}/${sanitized}_${shortId}`
}

function composeAgentName(first, last) {
    const f = typeof first === "string" ? first : ""
    const l = typeof last === "string" ? last : ""
    return `${f} ${l}`.trim()
}

function urlToKey(url) {
    if (typeof url !== "string") return null
    if (!url.startsWith(S3_URL_PREFIX)) return null
    return url.slice(S3_URL_PREFIX.length)
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────
async function main() {
    const mode = APPLY ? "APPLY" : "DRY-RUN"
    console.log("")
    console.log(`KYC S3 folder migration — ${mode}`)
    console.log(`  bucket : ${S3_BUCKET} (${S3_REGION})`)
    console.log(`  db     : ${dbIdentity(DATABASE_URL)}`)
    console.log("")

    const totals = { scanned: 0, alreadyOk: 0, planned: 0, applied: 0, skipped: 0, failed: 0 }

    for (const [table, level] of Object.entries(TABLE_TO_LEVEL)) {
        console.log(`── ${table} (level=${level}) ─────────────────────`)
        let rows
        try {
            const res = await pool.query(
                `SELECT id, first_name, last_name, pan_card_photo, aadhar_card_photo
                 FROM ${table}
                 WHERE pan_card_photo IS NOT NULL OR aadhar_card_photo IS NOT NULL`
            )
            rows = res.rows
        } catch (err) {
            console.error(`  SELECT failed on ${table}:`, err.message || err)
            continue
        }
        console.log(`  ${rows.length} row(s) with at least one photo URL`)

        for (const row of rows) {
            const agentName = composeAgentName(row.first_name, row.last_name)
            const targetFolder = buildSubAdminFolder(level, agentName, row.id)
            for (const col of PHOTO_COLUMNS) {
                totals.scanned += 1
                const url = row[col]
                if (!url) continue
                const oldKey = urlToKey(url)
                if (!oldKey) {
                    console.warn(
                        `  [skip] ${table} id=${row.id} ${col}: URL does not match bucket prefix (${url})`
                    )
                    totals.skipped += 1
                    continue
                }
                const filename = oldKey.split("/").pop() || ""
                if (!filename) {
                    console.warn(
                        `  [skip] ${table} id=${row.id} ${col}: cannot derive filename from key (${oldKey})`
                    )
                    totals.skipped += 1
                    continue
                }
                const newKey = `${targetFolder}/${filename}`
                if (oldKey === newKey) {
                    totals.alreadyOk += 1
                    continue
                }

                const label = `${table} id=${row.id} ${col}`
                console.log(`  [${APPLY ? "apply" : "plan"}] ${label}`)
                console.log(`    old: ${oldKey}`)
                console.log(`    new: ${newKey}`)
                totals.planned += 1

                if (!APPLY) continue

                try {
                    await s3.send(
                        new HeadObjectCommand({ Bucket: S3_BUCKET, Key: oldKey })
                    )
                } catch (err) {
                    if (err && err.$metadata && err.$metadata.httpStatusCode === 404) {
                        console.warn(`    [skip] source object missing in S3, leaving DB untouched`)
                        totals.skipped += 1
                        continue
                    }
                    console.error(`    HeadObject failed:`, err.message || err)
                    totals.failed += 1
                    continue
                }

                try {
                    await s3.send(
                        new CopyObjectCommand({
                            Bucket: S3_BUCKET,
                            CopySource: `/${S3_BUCKET}/${encodeURI(oldKey)}`,
                            Key: newKey,
                        })
                    )
                } catch (err) {
                    console.error(`    CopyObject failed:`, err.message || err)
                    totals.failed += 1
                    continue
                }

                try {
                    await pool.query(
                        `UPDATE ${table} SET ${col} = $1 WHERE id = $2`,
                        [`${S3_URL_PREFIX}${newKey}`, row.id]
                    )
                } catch (err) {
                    console.error(
                        `    UPDATE failed (leaving old object in place):`,
                        err.message || err
                    )
                    totals.failed += 1
                    continue
                }

                try {
                    await s3.send(
                        new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey })
                    )
                } catch (err) {
                    console.warn(
                        `    DeleteObject failed (DB already updated, old key orphaned):`,
                        err.message || err
                    )
                }

                totals.applied += 1
            }
        }
        console.log("")
    }

    console.log("Summary")
    console.log(`  columns scanned     : ${totals.scanned}`)
    console.log(`  already in target   : ${totals.alreadyOk}`)
    console.log(`  ${APPLY ? "migrated" : "would migrate "}      : ${totals.planned}`)
    if (APPLY) {
        console.log(`  successfully applied: ${totals.applied}`)
    }
    console.log(`  skipped (no-op)     : ${totals.skipped}`)
    console.log(`  failed              : ${totals.failed}`)
    if (!APPLY) {
        console.log("")
        console.log("Dry-run complete. Re-run with --apply to perform the changes.")
    }
}

function dbIdentity(connStr) {
    if (!connStr) return ""
    try {
        const u = new URL(connStr)
        return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname || ""}`
    } catch {
        return ""
    }
}

main()
    .catch((err) => {
        console.error("Fatal:", err)
        process.exitCode = 1
    })
    .finally(async () => {
        try {
            await pool.end()
        } catch (err) {
            console.error("Failed to close pool:", err.message || err)
        }
    })
