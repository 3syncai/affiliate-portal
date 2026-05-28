import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { ensureSubAdminKycSchema } from "@/lib/subadmin-kyc";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const BANK_FIELDS = [
    "account_name",
    "bank_name",
    "bank_branch",
    "ifsc_code",
    "account_number",
] as const;

type BankField = (typeof BANK_FIELDS)[number];

const PROTECTED_FIELDS = new Set([
    "pan_card_no",
    "pan_card_photo",
    "aadhar_card_no",
    "aadhar_card_photo",
    "profile_completed",
    "id",
    "email",
    "first_name",
    "last_name",
    "phone",
    "branch",
    "city",
    "state",
    "refer_code",
]);

const SELECT_COLUMNS = `
    id, first_name, last_name, email, phone, branch, city, state, refer_code,
    pan_card_no, pan_card_photo, aadhar_card_no, aadhar_card_photo,
    account_name, bank_name, bank_branch, ifsc_code, account_number,
    COALESCE(profile_completed, FALSE) AS profile_completed
`;

function makePool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
}

function authorize(req: NextRequest): { ok: true; userId: string } | { ok: false; res: NextResponse } {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { ok: false, res: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
    }
    const token = authHeader.split(" ")[1];
    let decoded: any;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch {
        return { ok: false, res: NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 }) };
    }
    if (decoded.role !== "branch") {
        return { ok: false, res: NextResponse.json({ success: false, message: "Invalid role" }, { status: 403 }) };
    }
    return { ok: true, userId: decoded.id };
}

export async function GET(req: NextRequest) {
    const auth = authorize(req);
    if (!auth.ok) return auth.res;

    const pool = makePool();
    try {
        await ensureSubAdminKycSchema(pool);
        const result = await pool.query(
            `SELECT ${SELECT_COLUMNS} FROM branch_admin WHERE id = $1`,
            [auth.userId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, user: result.rows[0] });
    } catch (error: any) {
        console.error("Failed to fetch branch admin profile:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}

export async function PATCH(req: NextRequest) {
    const auth = authorize(req);
    if (!auth.ok) return auth.res;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
    }

    for (const key of Object.keys(body)) {
        if (PROTECTED_FIELDS.has(key)) {
            return NextResponse.json(
                { success: false, message: `Field '${key}' cannot be updated from this endpoint` },
                { status: 400 }
            );
        }
    }

    const updates: Partial<Record<BankField, string>> = {};
    for (const field of BANK_FIELDS) {
        const raw = body[field];
        if (raw === undefined) continue;
        const value = typeof raw === "string" ? raw.trim() : "";
        if (!value) {
            return NextResponse.json(
                { success: false, message: `Field '${field}' cannot be empty` },
                { status: 400 }
            );
        }
        updates[field] = value;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ success: false, message: "No bank fields supplied" }, { status: 400 });
    }

    const pool = makePool();
    try {
        await ensureSubAdminKycSchema(pool);

        const setClauses: string[] = [];
        const values: unknown[] = [];
        let idx = 1;
        for (const [field, value] of Object.entries(updates)) {
            setClauses.push(`${field} = $${idx++}`);
            values.push(value);
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(auth.userId);

        const result = await pool.query(
            `UPDATE branch_admin SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING ${SELECT_COLUMNS}`,
            values
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Bank details updated successfully",
            user: result.rows[0],
        });
    } catch (error: any) {
        console.error("Failed to update branch admin bank details:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        await pool.end();
    }
}
