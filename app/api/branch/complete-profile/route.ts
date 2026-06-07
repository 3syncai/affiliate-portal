import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleCompleteSubAdminProfile } from "@/lib/subadmin-kyc"
import { requireSubAdminAuth } from "@/lib/sub-admin-auth"

export const dynamic = "force-dynamic"

// "Branch" in product terminology = branch_admin table (the ASM tier).
export async function POST(req: NextRequest) {
    const auth = requireSubAdminAuth(req, "branch")
    if (!auth.ok) return auth.res

    return handleCompleteSubAdminProfile(req, {
        pool,
        table: "branch_admin",
        s3Level: "asm",
        authUserId: auth.userId,
        returningColumns:
            "id, first_name, last_name, email, phone, branch, city, state, refer_code, profile_completed",
        logPrefix: "[branch/complete-profile]",
    })
}
