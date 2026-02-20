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
    console.log("=== State Admin Login ===");

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        // Find state admin by email
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, state, refer_code, is_active, created_at
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
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`State admin logged in: ${stateAdmin.email} (${stateAdmin.state})`);

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "state",
            user: {
                id: stateAdmin.id,
                first_name: stateAdmin.first_name,
                last_name: stateAdmin.last_name,
                email: stateAdmin.email,
                phone: stateAdmin.phone,
                state: stateAdmin.state,
                refer_code: stateAdmin.refer_code
            }
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("State admin login failed:", err);
        return NextResponse.json(
            {
                success: false,
                message: "Login failed",
                error: err.message
            },
            { status: 500 }
        );
    }
}
