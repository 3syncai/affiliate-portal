import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
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
      try {
        await syncAffiliateCommissionStatuses(pool, {
          logPrefix: "[National Activity]",
        });
      } catch (err) {
        console.warn("[National Activity] status sync failed:", err);
      }
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
