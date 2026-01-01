import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Creating State Admin ===");

    try {
        const body = await req.json();
        const { first_name, last_name, email, phone, state, password } = body;

        // Validate required fields
        if (!first_name || !last_name || !email || !phone || !state || !password) {
            return NextResponse.json(
                { success: false, message: "All fields are required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { success: false, message: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Connect to database
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Check if email already exists in state_admin table
        const existingStateAdmin = await pool.query(
            "SELECT id FROM state_admin WHERE email = $1",
            [email]
        );

        if (existingStateAdmin.rows.length > 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Email already registered as state admin" },
                { status: 400 }
            );
        }

        // Insert state admin into state_admin table (no referral code)
        // Normalize state name (First letter caps)
        const insertQuery = `
            INSERT INTO state_admin (
                first_name, last_name, email, password_hash, phone, state, is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, INITCAP(LOWER($6)), TRUE, NOW(), NOW()
            ) RETURNING id, email, first_name, last_name, state, is_active
        `;

        const result = await pool.query(insertQuery, [
            first_name,
            last_name,
            email,
            hashedPassword,
            phone,
            state
        ]);

        await pool.end();

        const user = result.rows[0];
        console.log(`State admin created: ${user.email} for state ${user.state}`);

        return NextResponse.json({
            success: true,
            message: "State admin created successfully",
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                state: user.state,
                is_active: user.is_active
            }
        });

    } catch (error: any) {
        console.error("Failed to create state admin:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create state admin",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
