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
    console.log("=== Affiliate Login ===");

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        // Find affiliate by email
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, is_approved, created_at
             FROM affiliate_user WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const affiliate = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, affiliate.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: affiliate.id,
                email: affiliate.email,
                role: "affiliate"
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`Affiliate logged in: ${affiliate.email}`);

        return NextResponse.json({
            token,
            role: "affiliate",
            is_approved: affiliate.is_approved,
            user: {
                id: affiliate.id,
                first_name: affiliate.first_name,
                last_name: affiliate.last_name,
                email: affiliate.email,
                phone: affiliate.phone
            }
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Affiliate login failed:", err);
        return NextResponse.json(
            {
                message: "Login failed",
                error: err.message
            },
            { status: 500 }
        );
    }
}
