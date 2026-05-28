import { NextRequest } from "next/server"
import {
    handleSubAdminMeGet,
    handleSubAdminMePatch,
} from "@/lib/subadmin-me-handler"

export const dynamic = "force-dynamic"

const SELECT_COLUMNS = `
    id, first_name, last_name, email, phone, state, refer_code,
    pan_card_no, pan_card_photo, aadhar_card_no, aadhar_card_photo,
    account_name, bank_name, bank_branch, ifsc_code, account_number,
    COALESCE(profile_completed, FALSE) AS profile_completed
`

export async function GET(req: NextRequest) {
    return handleSubAdminMeGet(req, {
        role: "state",
        table: "state_admin",
        selectColumns: SELECT_COLUMNS,
    })
}

export async function PATCH(req: NextRequest) {
    return handleSubAdminMePatch(req, {
        role: "state",
        table: "state_admin",
        selectColumns: SELECT_COLUMNS,
    })
}
