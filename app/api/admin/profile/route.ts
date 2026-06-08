import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const normalize = (value: unknown) => String(value ?? "").trim();

const ensurePhoneColumn = async () => {
    await pool.query(`
        ALTER TABLE affiliate_admin
        ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `);
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export async function GET(req: NextRequest) {
    try {
        await ensurePhoneColumn();

        const adminId = req.nextUrl.searchParams.get("id");
        if (!adminId) {
            return NextResponse.json(
                { success: false, error: "Admin ID is required" },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `SELECT id, name, email, phone, created_at, updated_at
             FROM affiliate_admin
             WHERE id = $1
             LIMIT 1`,
            [adminId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Admin not found" },
                { status: 404 }
            );
        }

        const row = result.rows[0];
        return NextResponse.json({
            success: true,
            profile: {
                id: row.id,
                name: row.name ?? null,
                email: row.email ?? null,
                phone: row.phone ?? null,
                created_at: row.created_at ?? null,
                updated_at: row.updated_at ?? null,
            },
        });
    } catch (error) {
        console.error("Failed to fetch admin profile:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch admin profile" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        await ensurePhoneColumn();

        const body = await req.json();
        const adminId = normalize(body?.id);
        const phoneRaw = normalize(body?.phone);

        if (!adminId) {
            return NextResponse.json(
                { success: false, error: "Admin ID is required" },
                { status: 400 }
            );
        }

        if (!phoneRaw) {
            return NextResponse.json(
                { success: false, error: "Phone number is required" },
                { status: 400 }
            );
        }

        const phone = normalizePhone(phoneRaw);
        if (phone.length !== 10) {
            return NextResponse.json(
                { success: false, error: "Enter a valid 10-digit mobile number" },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `UPDATE affiliate_admin
             SET phone = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, email, phone, created_at, updated_at`,
            [phone, adminId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Admin not found" },
                { status: 404 }
            );
        }

        const row = result.rows[0];
        return NextResponse.json({
            success: true,
            message: "Profile updated successfully",
            profile: {
                id: row.id,
                name: row.name ?? null,
                email: row.email ?? null,
                phone: row.phone ?? null,
                created_at: row.created_at ?? null,
                updated_at: row.updated_at ?? null,
            },
        });
    } catch (error) {
        console.error("Failed to update admin profile:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update admin profile" },
            { status: 500 }
        );
    }
}
