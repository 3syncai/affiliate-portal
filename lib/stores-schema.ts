import pool from "@/lib/db"

let schemaReady: Promise<void> | null = null

export async function ensureStoresPincodeSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(
        `ALTER TABLE stores ADD COLUMN IF NOT EXISTS pincode VARCHAR(6)`,
      )
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_stores_pincode ON stores(pincode)`,
      )
    })()
  }

  await schemaReady
}

export function validateStorePincode(pincode: unknown): string | null {
  if (pincode === undefined || pincode === null || pincode === "") {
    return null
  }

  const normalized = String(pincode).replace(/\D/g, "").slice(0, 6)
  if (!/^\d{6}$/.test(normalized)) {
    return null
  }

  return normalized
}
