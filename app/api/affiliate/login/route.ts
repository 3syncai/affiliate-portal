import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function POST(req: NextRequest) {
    console.log("=== Affiliate/Admin Login ===");

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

        // Check if it's a main admin login
        const adminQuery = `SELECT id, email, name FROM admin_users WHERE email = $1`;
        const adminResult = await pool.query(adminQuery, [email]);

        if (adminResult.rows.length > 0) {
            const admin = adminResult.rows[0];

            // For now, use a simple admin password check
            // TODO: Add password_hash column to admin_users table for production
            if (password === "admin123") {
                await pool.end();

                const token = jwt.sign(
                    {
                        id: admin.id,
                        email: admin.email,
                        role: "admin"
                    },
                    JWT_SECRET,
                    { expiresIn: "7d" }
                );

                console.log(`Admin logged in: ${admin.email}`);

                return NextResponse.json({
                    success: true,
                    message: "Login successful",
                    token,
                    role: "admin",
                    user: {
                        id: admin.id,
                        email: admin.email,
                        name: admin.name
                    }
                });
            } else {
                // Wrong password for admin
                await pool.end();
                return NextResponse.json(
                    { success: false, message: "Invalid email or password" },
                    { status: 401 }
                );
            }
        }

        // If not admin, check affiliate users
        const affiliateQuery = `
            SELECT id, first_name, last_name, email, password_hash, phone, refer_code, 
                   branch, area, state, city, designation, is_approved, is_agent, created_at
            FROM affiliate_user 
            WHERE email = $1
        `;
        const result = await pool.query(affiliateQuery, [email]);

        if (result.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            await pool.end();
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        await pool.end();

        // Determine user role based on designation or other fields
        let role = "affiliate";
        if (user.designation === "state") {
            role = "state";
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: role,
                branch: user.branch,
                area: user.area,
                state: user.state,
                city: user.city
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log(`Affiliate logged in: ${user.email} (${role})`);

        return NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            role: role,
            is_approved: user.is_approved,
            redirectTo: !user.is_approved ? "/verification-pending" : null,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                refer_code: user.refer_code,
                branch: user.branch,
                area: user.area,
                state: user.state,
                city: user.city,
                designation: user.designation,
                is_approved: user.is_approved
            }
        });

    } catch (error: any) {
        console.error("Affiliate/Admin login failed:", error);
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
