import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

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

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Find affiliate by email
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, is_approved, created_at
             FROM affiliate_user WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const affiliate = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, affiliate.password_hash);
        if (!isPasswordValid) {
            await pool.end();
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        await pool.end();

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

    } catch (error: any) {
        console.error("Affiliate login failed:", error);
        return NextResponse.json(
            {
                message: "Login failed",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
