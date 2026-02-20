import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic"

const secret = process.env.JWT_SECRET;
if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
}
const JWT_SECRET = secret as string;

export async function POST(req: NextRequest) {
    console.log("=== Branch Admin Login ===");

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 });
        }

        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, branch, city, state, role, is_active, refer_code
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

        await pool.end();

        const token = jwt.sign(
            { id: branchAdmin.id, email: branchAdmin.email, role: "branch", branch: branchAdmin.branch, city: branchAdmin.city, state: branchAdmin.state },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`Branch Admin logged in: ${branchAdmin.email} (${branchAdmin.branch})`);

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "branch",
            user: {
                id: branchAdmin.id,
                first_name: branchAdmin.first_name,
                last_name: branchAdmin.last_name,
                email: branchAdmin.email,
                phone: branchAdmin.phone,
                branch: branchAdmin.branch,
                city: branchAdmin.city,
                state: branchAdmin.state,
                refer_code: branchAdmin.refer_code
            }
        });
    } catch (error: unknown) {
        console.error("Branch Admin login failed:", error);
        return NextResponse.json({ success: false, message: "Login failed" }, { status: 500 });
    }
}
