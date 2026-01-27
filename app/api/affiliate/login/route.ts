import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function POST(req: NextRequest) {
    console.log("=== Affiliate/Admin Login (Restored) ===");

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
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL
        });

        // 1. CHECK MAIN ADMIN TABLE (affiliate_admin)
        // This table was missing but has been restored
        const adminQuery = `
            SELECT id, name, email, password_hash 
            FROM affiliate_admin 
            WHERE email = $1
        `;
        const adminResult = await pool.query(adminQuery, [email]);

        if (adminResult.rows.length > 0) {
            const admin = adminResult.rows[0];

            // Verify admin password
            const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
            if (!isPasswordValid) {
                await pool.end();
                return NextResponse.json(
                    { success: false, message: "Invalid email or password" },
                    { status: 401 }
                );
            }

            await pool.end();

            // Generate Admin Token
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
                    name: admin.name,
                    email: admin.email,
                    role: "admin"
                }
            });
        }

        // 2. CHECK AFFILIATE USER TABLE
        // Fallback for regular affiliates
        const query = `
            SELECT id, first_name, last_name, email, password_hash, phone, refer_code, 
                   branch, area, state, city, designation, is_approved, created_at
            FROM affiliate_user 
            WHERE email = $1
        `;

        // Note: We use try/catch here because 'area' or 'designation' columns might still be missing 
        // in some environments, but we want to fail gracefully if so.
        // However, based on latest checks, we believe the schema uses 'designation' and 'area'
        // If not, we fall back to a simpler query.

        let result;
        try {
            result = await pool.query(query, [email]);
        } catch (e) {
            console.log("Full query failed, trying fallback details query...");
            // Fallback query matching verified minimal schema just in case
            const fallbackQuery = `
                SELECT id, first_name, last_name, email, password_hash, phone, refer_code, 
                       branch, state, city, is_approved, created_at
                FROM affiliate_user 
                WHERE email = $1
            `;
            result = await pool.query(fallbackQuery, [email]);
        }

        if (result.rows.length === 0) {
            await pool.end();
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                    debug_info: {
                        step: "checks_completed",
                        admin_found: false,
                        affiliate_found: false,
                        email_checked: email,
                        db_url_exists: !!(process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL)
                    }
                },
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

        // Determine user role
        // Prioritize designation if it exists, otherwise check role column (if it existed) or default to affiliate
        let role = "affiliate";
        if (user.designation === "admin") role = "admin";
        else if (user.designation === "state") role = "state";

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: role,
                branch: user.branch,
                area: user.area, // might be undefined if fallback query used
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
                role: role,
                is_approved: user.is_approved
            }
        });

    } catch (error: any) {
        console.error("Login critical error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Login failed (Server Error)",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}