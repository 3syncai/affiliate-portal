import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

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
      `SELECT id, branch_name, city, state, is_active, contact_phone, created_at
       FROM stores
       WHERE state ILIKE $1 AND COALESCE(is_active, true) = true
       ORDER BY city, branch_name`,
      [state],
    );

    await pool.end();

    return NextResponse.json({
      success: true,
      stores: result.rows,
      count: result.rows.length,
    });
  } catch (error: unknown) {
    console.error("[state-admin/stores] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
