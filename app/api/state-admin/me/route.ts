import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

interface DecodedToken {
    id: string;
    email: string;
    role: string;
    state: string;
}

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        let decoded: DecodedToken;
        try {
            decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
        } catch {
            return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
        }

        if (decoded.role !== "state") {
            return NextResponse.json({ success: false, message: "Invalid role" }, { status: 403 });
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const query = `
            SELECT id, first_name, last_name, email, phone, state, refer_code
            FROM state_admin WHERE id = $1
        `;
        const result = await pool.query(query, [decoded.id]);
        await pool.end();

        if (result.rows.length === 0) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch state admin profile:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
