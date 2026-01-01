import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    console.log("=== Creating Branch Admin ===");

    try {
        const body = await req.json();
        const { first_name, last_name, email, phone, branch, password, asm_id } = body;

        if (!first_name || !last_name || !email || !phone || !branch || !password || !asm_id) {
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

        const hashedPassword = await bcrypt.hash(password, 10);

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Get city and state from ASM
        const asmResult = await pool.query(
            "SELECT city, state FROM area_sales_manager WHERE id = $1",
            [asm_id]
        );

        if (asmResult.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Area Sales Manager not found" },
                { status: 404 }
            );
        }

        const { city, state } = asmResult.rows[0];

        // Check if email already exists
        const existingBranch = await pool.query(
            "SELECT id FROM branch_admin WHERE email = $1",
            [email]
        );

        if (existingBranch.rows.length > 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Email already registered" },
                { status: 400 }
            );
        }

        // Insert Branch Admin with normalized names (First letter caps)
        const insertQuery = `
            INSERT INTO branch_admin (
                first_name, last_name, email, password_hash, phone, branch, city, state, created_by, role, is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, INITCAP(LOWER($6)), INITCAP(LOWER($7)), INITCAP(LOWER($8)), $9, 'branch', TRUE, NOW(), NOW()
            ) RETURNING id, email, first_name, last_name, branch, city, state, role, is_active
        `;

        const result = await pool.query(insertQuery, [
            first_name,
            last_name,
            email,
            hashedPassword,
            phone,
            branch,
            city,
            state,
            asm_id
        ]);

        await pool.end();

        const branchAdmin = result.rows[0];
        console.log(`Branch Admin created: ${branchAdmin.email} for branch ${branchAdmin.branch}`);

        return NextResponse.json({
            success: true,
            message: "Branch Admin created successfully",
            branchAdmin: {
                id: branchAdmin.id,
                email: branchAdmin.email,
                first_name: branchAdmin.first_name,
                last_name: branchAdmin.last_name,
                branch: branchAdmin.branch,
                city: branchAdmin.city,
                state: branchAdmin.state,
                role: branchAdmin.role,
                is_active: branchAdmin.is_active
            }
        });

    } catch (error: any) {
        console.error("Failed to create Branch Admin:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create Branch Admin",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
