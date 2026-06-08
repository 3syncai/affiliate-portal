import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

/** ASM list for State Admin UI (branch_admin table). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");

    if (!state) {
      return NextResponse.json(
        { success: false, error: "State parameter is required" },
        { status: 400 },
      );
    }

    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const result = await pool.query(
      `SELECT id, first_name, last_name, email, phone, branch, city, state, is_active, created_at
       FROM branch_admin
       WHERE state ILIKE $1
       ORDER BY created_at DESC`,
      [state],
    );

    await pool.end();

    return NextResponse.json({
      success: true,
      asms: result.rows,
      count: result.rows.length,
    });
  } catch (error: unknown) {
    console.error("[state-admin/branch-admins] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
