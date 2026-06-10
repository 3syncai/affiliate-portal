const PINCODE_API_BASE = "https://api.postalpincode.in/pincode"

export type IndiaPostOffice = {
  name: string
  district: string
  state: string
  block: string
  division: string
  branchType: string
  deliveryStatus: string
  pincode: string
}

export type PincodeLookupResult = {
  pincode: string
  offices: IndiaPostOffice[]
  message: string
}

type RawPostOffice = {
  Name?: string
  District?: string
  State?: string
  Block?: string
  Division?: string
  BranchType?: string
  DeliveryStatus?: string
  Pincode?: string
}

type RawPincodeResponse = {
  Status?: string
  Message?: string
  PostOffice?: RawPostOffice[] | null
}

export function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode)
}

function normalizeOffice(raw: RawPostOffice, pincode: string): IndiaPostOffice {
  return {
    name: String(raw.Name || "").trim(),
    district: String(raw.District || "").trim(),
    state: String(raw.State || "").trim(),
    block: String(raw.Block || "").trim(),
    division: String(raw.Division || "").trim(),
    branchType: String(raw.BranchType || "").trim(),
    deliveryStatus: String(raw.DeliveryStatus || "").trim(),
    pincode: String(raw.Pincode || pincode).trim(),
  }
}

export function composeAddressFromOffice(office: IndiaPostOffice): string {
  const parts = [office.division, office.block, office.district]
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.join(", ")
}

export async function fetchPincodeDetails(
  pincode: string,
): Promise<PincodeLookupResult> {
  const normalized = pincode.replace(/\D/g, "").slice(0, 6)

  if (!isValidPincode(normalized)) {
    throw new PincodeLookupError("Pincode must be exactly 6 digits.", 400)
  }

  const response = await fetch(`${PINCODE_API_BASE}/${normalized}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  })

  if (!response.ok) {
    throw new PincodeLookupError(
      "Failed to fetch pincode details. Please try again.",
      502,
    )
  }

  const data = (await response.json()) as RawPincodeResponse[] | RawPincodeResponse
  const entry = Array.isArray(data) ? data[0] : data

  if (!entry || entry.Status !== "Success" || !entry.PostOffice?.length) {
    throw new PincodeLookupError(
      entry?.Message || "No locations found for this pincode.",
      404,
    )
  }

  const offices = entry.PostOffice
    .map((office) => normalizeOffice(office, normalized))
    .filter((office) => office.name && office.state)

  if (offices.length === 0) {
    throw new PincodeLookupError("No locations found for this pincode.", 404)
  }

  return {
    pincode: normalized,
    offices,
    message: entry.Message || `Found ${offices.length} location(s).`,
  }
}

export class PincodeLookupError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "PincodeLookupError"
    this.status = status
  }
}
