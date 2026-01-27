// Environment configuration for affiliate portal
// All URLs are configurable via environment variables

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.MEDUSA_BACKEND_URL
export const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "http://localhost:3000"
export const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || process.env.MEDUSA_PUBLISHABLE_KEY

