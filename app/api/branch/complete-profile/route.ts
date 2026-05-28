import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleCompleteSubAdminProfile } from "@/lib/subadmin-kyc"

export const dynamic = "force-dynamic"

// "Branch" in product terminology = branch_admin table (the ASM tier).
export async function POST(req: NextRequest) {
    return handleCompleteSubAdminProfile(req, {
        pool,
        table: "branch_admin",
        s3Level: "asm",
        returningColumns:
            "id, first_name, last_name, email, phone, branch, city, state, refer_code, profile_completed",
        logPrefix: "[branch/complete-profile]",
    })
}
