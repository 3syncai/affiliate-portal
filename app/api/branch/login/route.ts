import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDatabaseUrl, getJwtSecret } from "@/lib/env";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Branch Admin Login ===");

    let pool: Pool | undefined

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 });
        }

        pool = new Pool({
            connectionString: getDatabaseUrl(),
            ssl: { rejectUnauthorized: false }
        });

        // Schema is provisioned by migrations/add_subadmin_kyc.sql at deploy
        // time; we no longer ALTER TABLE on the hot path.
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, branch, city, state, role, is_active, refer_code,
                    COALESCE(profile_completed, FALSE) AS profile_completed
             FROM branch_admin WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "Invalid email or password" }, { status: 401 });
        }

        const branchAdmin = result.rows[0];

        if (!branchAdmin.is_active) {
            return NextResponse.json({ success: false, message: "Account is deactivated. Please contact your Area Manager." }, { status: 403 });
        }

        const isPasswordValid = await bcrypt.compare(password, branchAdmin.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json({ success: false, message: "Invalid email or password" }, { status: 401 });
        }

        const token = jwt.sign(
            { id: branchAdmin.id, email: branchAdmin.email, role: "branch", branch: branchAdmin.branch, city: branchAdmin.city, state: branchAdmin.state },
            getJwtSecret(),
            { expiresIn: "7d" }
        );

        console.log(`Branch Admin logged in: ${branchAdmin.email} (${branchAdmin.branch})`);

        const profileCompleted = !!branchAdmin.profile_completed;

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "branch",
            profile_completed: profileCompleted,
            redirectTo: profileCompleted ? null : "/complete-profile",
            user: {
                id: branchAdmin.id,
                first_name: branchAdmin.first_name,
                last_name: branchAdmin.last_name,
                email: branchAdmin.email,
                phone: branchAdmin.phone,
                branch: branchAdmin.branch,
                city: branchAdmin.city,
                state: branchAdmin.state,
                refer_code: branchAdmin.refer_code,
                profile_completed: profileCompleted
            }
        });
    } catch (error: any) {
        console.error("Branch Admin login failed:", error);
        return NextResponse.json({ success: false, message: "Login failed" }, { status: 500 });
    } finally {
        await pool?.end().catch((endError) => {
            console.error("Failed to close Branch Admin login pool:", endError);
        });
    }
}
