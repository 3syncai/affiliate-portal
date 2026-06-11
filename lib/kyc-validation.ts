/** Indian PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F). */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** Valid 4th-character entity types per Indian PAN rules. */
const PAN_ENTITY_CHARS = "CPHFATBLJG"

export function formatPanInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)
}

export function formatAadharInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12)
  if (digits.length <= 4) return digits
  if (digits.length <= 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
}

export function normalizePan(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function normalizeAadhar(value: string): string {
  return value.replace(/\D/g, "")
}

export function validatePanNumber(value: string): {
  valid: boolean
  message?: string
} {
  const pan = normalizePan(value)

  if (pan.length !== 10) {
    return {
      valid: false,
      message: "PAN must be 10 characters (e.g. ABCDE1234F).",
    }
  }

  if (!PAN_REGEX.test(pan)) {
    return {
      valid: false,
      message:
        "Invalid PAN format. Use 5 letters, 4 digits, then 1 letter (e.g. ABCDE1234F).",
    }
  }

  if (!PAN_ENTITY_CHARS.includes(pan[3])) {
    return {
      valid: false,
      message: "Invalid PAN: the 4th character is not a valid entity type.",
    }
  }

  return { valid: true }
}

export function validateAadharNumber(value: string): {
  valid: boolean
  message?: string
} {
  const digits = normalizeAadhar(value)

  if (digits.length !== 12) {
    return {
      valid: false,
      message: "Aadhar must be exactly 12 digits.",
    }
  }

  if (!/^[2-9]/.test(digits)) {
    return {
      valid: false,
      message: "Aadhar number cannot start with 0 or 1.",
    }
  }

  if (/^(\d)\1{11}$/.test(digits)) {
    return {
      valid: false,
      message: "Aadhar number does not look valid.",
    }
  }

  return { valid: true }
}

export function validateKycNumbers(pan: string, aadhar: string): string | null {
  const panResult = validatePanNumber(pan)
  if (!panResult.valid) return panResult.message ?? "Invalid PAN card number."

  const aadharResult = validateAadharNumber(aadhar)
  if (!aadharResult.valid) {
    return aadharResult.message ?? "Invalid Aadhar card number."
  }

  return null
}
