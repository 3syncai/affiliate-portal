import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { handleSubAdminKycEdit } from "@/lib/subadmin-kyc"
import { requireSubAdminAuth } from "@/lib/sub-admin-auth"

export const dynamic = "force-dynamic"

// Matches /api/state-admin/me's SELECT shape so the client can swap state directly.
const RETURNING_COLUMNS = `
    id, first_name, last_name, email, phone, state, refer_code,
    pan_card_no, pan_card_photo, aadhar_card_no, aadhar_card_photo,
    account_name, bank_name, bank_branch, ifsc_code, account_number,
    COALESCE(profile_completed, FALSE) AS profile_completed
`

export async function PATCH(req: NextRequest) {
    const auth = requireSubAdminAuth(req, "state")
    if (!auth.ok) return auth.res

    return handleSubAdminKycEdit(req, {
        pool,
        table: "state_admin",
        s3Level: "state_admin",
        authUserId: auth.userId,
        returningColumns: RETURNING_COLUMNS,
        logPrefix: "[state-admin/kyc]",
    })
}
