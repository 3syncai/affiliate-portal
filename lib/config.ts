// Environment configuration for affiliate portal
// All URLs are configurable via environment variables

export const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.MEDUSA_BACKEND_URL
const storeUrl = process.env.NEXT_PUBLIC_STORE_URL
if (!storeUrl || storeUrl.trim().length === 0) {
  throw new Error("[config] Missing required environment variable: NEXT_PUBLIC_STORE_URL")
}
export const STORE_URL = storeUrl
export const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || process.env.MEDUSA_PUBLISHABLE_KEY

