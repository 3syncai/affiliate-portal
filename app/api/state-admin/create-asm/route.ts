import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Creating Area Sales Manager ===");

    try {
        const body = await req.json();
        const { first_name, last_name, email, phone, city, password, state_admin_id } = body;

        // Validate required fields
        if (!first_name || !last_name || !email || !phone || !city || !password || !state_admin_id) {
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

        // Get state from state admin
        const stateAdminResult = await pool.query(
            "SELECT state FROM state_admin WHERE id = $1",
            [state_admin_id]
        );

        if (stateAdminResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "State admin not found" },
                { status: 404 }
            );
        }

        const state = stateAdminResult.rows[0].state;

        // Check if email already exists
        const existingASM = await pool.query(
            "SELECT id FROM area_sales_manager WHERE email = $1",
            [email]
        );

        if (existingASM.rows.length > 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Email already registered" },
                { status: 400 }
            );
        }

        // Generate unique referral code: ASM + first 3 chars of name + 5 random digits
        // Example: ASMJOH12345
        const generateReferCode = () => {
            const namePart = first_name.substring(0, 3).toUpperCase();
            const randomDigits = Math.floor(10000 + Math.random() * 90000);
            return `ASM${namePart}${randomDigits}`;
        }

        let generatedReferCode = generateReferCode();

        // Ensure unique refer code
        let codeExists = true;
        while (codeExists) {
            const codeCheck = await pool.query(
                "SELECT id FROM area_sales_manager WHERE refer_code = $1",
                [generatedReferCode]
            );
            if (codeCheck.rows.length === 0) {
                codeExists = false;
            } else {
                generatedReferCode = generateReferCode();
            }
        }

        // Insert ASM with normalized names (First letter caps)
        const insertQuery = `
            INSERT INTO area_sales_manager (
                first_name, last_name, email, password_hash, phone, city, state, created_by, refer_code, role, is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, INITCAP(LOWER($6)), INITCAP(LOWER($7)), $8, $9, 'asm', TRUE, NOW(), NOW()
            ) RETURNING id, email, first_name, last_name, city, state, refer_code, role, is_active
        `;

        const result = await pool.query(insertQuery, [
            first_name,
            last_name,
            email,
            hashedPassword,
            phone,
            city,
            state,
            state_admin_id,
            generatedReferCode
        ]);

        await pool.end();

        const asm = result.rows[0];
        console.log(`ASM created: ${asm.email} for city ${asm.city} in ${asm.state}`);

        return NextResponse.json({
            success: true,
            message: "Area Sales Manager created successfully",
            asm: {
                id: asm.id,
                email: asm.email,
                first_name: asm.first_name,
                last_name: asm.last_name,
                city: asm.city,
                state: asm.state,
                refer_code: asm.refer_code,
                role: asm.role,
                is_active: asm.is_active
            }
        });

    } catch (error: any) {
        console.error("Failed to create ASM:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create Area Sales Manager",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
