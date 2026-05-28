import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDatabaseUrl, getJwtSecret } from "@/lib/env";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== ASM Login ===");

    let pool: Pool | undefined

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        pool = new Pool({
            connectionString: getDatabaseUrl(),
            ssl: { rejectUnauthorized: false }
        });

        // Schema is provisioned by migrations/add_subadmin_kyc.sql at deploy
        // time; we no longer ALTER TABLE on the hot path.
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, city, state, role, is_active, refer_code,
                    COALESCE(profile_completed, FALSE) AS profile_completed, created_at
             FROM area_sales_manager WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const asm = result.rows[0];

        // Check if account is active
        if (!asm.is_active) {
            return NextResponse.json(
                { success: false, message: "Account is deactivated. Please contact your state admin." },
                { status: 403 }
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, asm.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: asm.id,
                email: asm.email,
                role: "asm",
                city: asm.city,
                state: asm.state
            },
            getJwtSecret(),
            { expiresIn: "7d" }
        );

        console.log(`ASM logged in: ${asm.email} (${asm.city}, ${asm.state})`);

        const profileCompleted = !!asm.profile_completed;

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "asm",
            profile_completed: profileCompleted,
            redirectTo: profileCompleted ? null : "/complete-profile",
            user: {
                id: asm.id,
                first_name: asm.first_name,
                last_name: asm.last_name,
                email: asm.email,
                phone: asm.phone,
                city: asm.city,
                state: asm.state,
                refer_code: asm.refer_code,
                profile_completed: profileCompleted
            }
        });

    } catch (error: any) {
        console.error("ASM login failed:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Login failed",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    } finally {
        await pool?.end().catch((endError) => {
            console.error("Failed to close ASM login pool:", endError);
        });
    }
}
