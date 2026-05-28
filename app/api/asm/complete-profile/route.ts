import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleCompleteSubAdminProfile } from "@/lib/subadmin-kyc"
import { requireSubAdminAuth } from "@/lib/sub-admin-auth"

export const dynamic = "force-dynamic"

// "ASM" in product terminology = area_sales_manager table (the Branch Head tier).
export async function POST(req: NextRequest) {
    const auth = requireSubAdminAuth(req, "asm")
    if (!auth.ok) return auth.res

    return handleCompleteSubAdminProfile(req, {
        pool,
        table: "area_sales_manager",
        s3Level: "branch_head",
        authUserId: auth.userId,
        returningColumns:
            "id, first_name, last_name, email, phone, city, state, refer_code, profile_completed",
        logPrefix: "[asm/complete-profile]",
    })
}
