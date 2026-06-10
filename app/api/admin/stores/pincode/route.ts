import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "@/lib/env"
import {
  fetchPincodeDetails,
  PincodeLookupError,
} from "@/lib/pincode/india-post"

export const dynamic = "force-dynamic"

function requireAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], getJwtSecret()) as {
      id?: string
      role?: string
    }

    if (decoded.role !== "admin" || !decoded.id) {
      return {
        ok: false as const,
        res: NextResponse.json(
          { success: false, message: "Invalid role" },
          { status: 403 },
        ),
      }
    }

    return { ok: true as const }
  } catch {
    return {
      ok: false as const,
      res: NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 },
      ),
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAdminAuth(req)
  if (!auth.ok) return auth.res

  const pincode = req.nextUrl.searchParams.get("pincode")?.trim() || ""

  try {
    const result = await fetchPincodeDetails(pincode)

    return NextResponse.json({
      success: true,
      pincode: result.pincode,
      offices: result.offices,
      message: result.message,
    })
  } catch (error) {
    if (error instanceof PincodeLookupError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      )
    }

    console.error("[admin/stores/pincode] failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to lookup pincode.",
      },
      { status: 500 },
    )
  }
}
