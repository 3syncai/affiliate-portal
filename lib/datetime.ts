/**
 * Date/time helpers for displaying server timestamps in IST.
 *
 * Why this exists:
 * Postgres `timestamp` (without time zone) values come back over the wire as
 * strings like "2026-05-06 09:57:00.123" with no offset. When the browser does
 * `new Date(thatString)` it interprets the value as the browser's *local* time
 * instead of UTC, which makes timestamps look hours off (e.g. showing 09:57 am
 * IST for an event that actually happened at 15:27 IST / 09:57 UTC).
 *
 * `parseServerDate` normalizes any incoming value (Date | string) into a Date
 * object that correctly represents the UTC instant, by appending "Z" when no
 * timezone marker is present.
 */

const HAS_TZ = /Z$|[+-]\d{2}:?\d{2}$/

export function parseServerDate(input: string | Date | null | undefined): Date | null {
    if (input === null || input === undefined) return null
    if (input instanceof Date) return input
    if (typeof input !== "string") return null
    const trimmed = input.trim()
    if (!trimmed) return null
    // If the string already carries a timezone (Z or +HH:MM), trust it.
    if (HAS_TZ.test(trimmed)) {
        const d = new Date(trimmed)
        return isNaN(d.getTime()) ? null : d
    }
    // Postgres "timestamp without time zone" comes back as "YYYY-MM-DD HH:MM:SS[.ms]"
    // — treat as UTC by replacing the space with "T" and appending "Z".
    const normalized = trimmed.replace(" ", "T") + "Z"
    const d = new Date(normalized)
    return isNaN(d.getTime()) ? null : d
}

const IST_OPTIONS_DATETIME: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
}

const IST_OPTIONS_DATE: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
}

export function formatIST(input: string | Date | null | undefined): string {
    const d = parseServerDate(input)
    if (!d) return ""
    return d.toLocaleString("en-IN", IST_OPTIONS_DATETIME)
}

export function formatISTDate(input: string | Date | null | undefined): string {
    const d = parseServerDate(input)
    if (!d) return ""
    return d.toLocaleDateString("en-IN", IST_OPTIONS_DATE)
}

/**
 * Compact relative time ("just now", "5m ago", "3h ago"), falling back to a
 * short IST date for anything older than 24h.
 */
export function formatRelativeIST(input: string | Date | null | undefined): string {
    const d = parseServerDate(input)
    if (!d) return ""
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 0) return "just now"
    if (diffSec < 60) return "just now"
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })
}
