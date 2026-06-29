import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchAffiliateDashboardStats } from "@/lib/admin-dashboard-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await fetchAffiliateDashboardStats(pool);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
