import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchAdminRoleStats } from "@/lib/admin-dashboard-stats";

export async function GET() {
  try {
    const stats = await fetchAdminRoleStats(pool);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch admin statistics" },
      { status: 500 },
    );
  }
}
