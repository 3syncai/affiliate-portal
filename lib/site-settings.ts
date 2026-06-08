import pool from "@/lib/db"

export const RIGHT_CLICK_KEY = "right_click_enabled"

let schemaReady: Promise<void> | null = null

async function ensureSiteSettingsSchema(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
}

function ensureSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = ensureSiteSettingsSchema()
    }
    return schemaReady
}

/** Default true — right-click allowed until you turn it off from debug controller. */
export async function isRightClickEnabled(): Promise<boolean> {
    await ensureSchema()
    const result = await pool.query(
        `SELECT value FROM site_settings WHERE key = $1`,
        [RIGHT_CLICK_KEY]
    )

    if (result.rows.length === 0) return true

    const value = result.rows[0].value
    if (typeof value === "boolean") return value
    if (value && typeof value.enabled === "boolean") return value.enabled
    return true
}

export async function setRightClickEnabled(enabled: boolean): Promise<boolean> {
    await ensureSchema()
    await pool.query(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [RIGHT_CLICK_KEY, JSON.stringify({ enabled })]
    )
    return enabled
}

export async function toggleRightClick(): Promise<boolean> {
    const current = await isRightClickEnabled()
    return setRightClickEnabled(!current)
}
