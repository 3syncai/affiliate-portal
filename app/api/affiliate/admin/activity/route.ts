import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { buildNationalActivities } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") || "15", 10), 1),
      100,
    );
    const skipSync = searchParams.get("skipSync") === "1";

    if (!skipSync) {
    }

    const activities = await buildNationalActivities(pool, limit);

    return NextResponse.json({
      success: true,
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Failed to fetch recent activity:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recent activity",
        message: error instanceof Error ? error.message : "Unknown error",
        activities: [],
      },
      { status: 500 },
    );
  }
}
