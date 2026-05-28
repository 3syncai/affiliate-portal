import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleCompleteSubAdminProfile } from "@/lib/subadmin-kyc"
import { requireSubAdminAuth } from "@/lib/sub-admin-auth"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const auth = requireSubAdminAuth(req, "state")
    if (!auth.ok) return auth.res

    return handleCompleteSubAdminProfile(req, {
        pool,
        table: "state_admin",
        s3Level: "state_admin",
        authUserId: auth.userId,
        returningColumns:
            "id, first_name, last_name, email, phone, state, refer_code, profile_completed",
        logPrefix: "[state-admin/complete-profile]",
    })
}
