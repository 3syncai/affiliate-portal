import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function POST(req: NextRequest) {
    console.log("=== ASM Login ===");

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

        // Find ASM by email
        const result = await pool.query(
            `SELECT id, first_name, last_name, email, password_hash, phone, city, state, role, is_active, refer_code, created_at
             FROM area_sales_manager WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const asm = result.rows[0];

        // Check if account is active
        if (!asm.is_active) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Account is deactivated. Please contact your state admin." },
                { status: 403 }
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, asm.password_hash);
        if (!isPasswordValid) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        await pool.end();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: asm.id,
                email: asm.email,
                role: "asm",
                city: asm.city,
                state: asm.state
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`ASM logged in: ${asm.email} (${asm.city}, ${asm.state})`);

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: "asm",
            user: {
                id: asm.id,
                first_name: asm.first_name,
                last_name: asm.last_name,
                email: asm.email,
                phone: asm.phone,
                city: asm.city,
                state: asm.state,
                refer_code: asm.refer_code
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
    }
}
