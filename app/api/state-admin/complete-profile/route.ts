import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleCompleteSubAdminProfile } from "@/lib/subadmin-kyc"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    return handleCompleteSubAdminProfile(req, {
        pool,
        table: "state_admin",
        s3Level: "state_admin",
        returningColumns:
            "id, first_name, last_name, email, phone, state, refer_code, profile_completed",
        logPrefix: "[state-admin/complete-profile]",
    })
}
