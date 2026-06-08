import { NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/debug-controller-auth"

export async function GET(req: NextRequest) {
    const auth = requireDebugAuth(req)
    if (!auth.ok) return auth.res

    return NextResponse.json({ success: true, authenticated: true })
}
