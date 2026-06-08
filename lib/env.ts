/**
 * Centralized environment-variable accessors.
 *
 * Every helper here fails closed: if the variable is missing the function
 * throws, which forces 5xx-with-clear-message responses upstream instead of
 * silently degrading to insecure defaults.
 *
 * Background:
 *   - `JWT_SECRET` historically fell back to a hard-coded string, which made
 *     tokens trivially forgeable when the env was misconfigured.
 *   - `DATABASE_URL` historically fell back to `NEXT_PUBLIC_DATABASE_URL`,
 *     which made it possible to wire server routes to a client-exposed secret.
 *
 * Both fallbacks are removed for any route that goes through these helpers.
 */

export function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

export function getJwtSecret(): string {
    return requireEnv("JWT_SECRET")
}

export function getDatabaseUrl(): string {
    return requireEnv("DATABASE_URL")
}
