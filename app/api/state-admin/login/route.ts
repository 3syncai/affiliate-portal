import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDatabaseUrl, getJwtSecret } from "@/lib/env";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== State Admin Login ===");

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
            `SELECT id, first_name, last_name, email, password_hash, phone, state, refer_code, is_active,
                    COALESCE(profile_completed, FALSE) AS profile_completed, created_at
             FROM state_admin WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const stateAdmin = result.rows[0];

        // Check if account is active
        if (!stateAdmin.is_active) {
            return NextResponse.json(
                { success: false, message: "Account is deactivated. Please contact admin." },
                { status: 403 }
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, stateAdmin.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: stateAdmin.id,
                email: stateAdmin.email,
                role: "state",
                state: stateAdmin.state
            },
            getJwtSecret(),
            { expiresIn: "7d" }
        );

        console.log(`State admin logged in: ${stateAdmin.email} (${stateAdmin.state})`);

        const profileCompleted = !!stateAdmin.profile_completed;

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "state",
            profile_completed: profileCompleted,
            redirectTo: profileCompleted ? null : "/complete-profile",
            user: {
                id: stateAdmin.id,
                first_name: stateAdmin.first_name,
                last_name: stateAdmin.last_name,
                email: stateAdmin.email,
                phone: stateAdmin.phone,
                state: stateAdmin.state,
                refer_code: stateAdmin.refer_code,
                profile_completed: profileCompleted
            }
        });

    } catch (error: any) {
        console.error("State admin login failed:", error);
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
            console.error("Failed to close State Admin login pool:", endError);
        });
    }
}
