import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchCommissionRates } from "@/lib/commission-rates";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { buildNationalActivities } from "@/lib/recent-activity";
import {
  fetchAffiliateDashboardStats,
  fetchAdminRoleStats,
} from "@/lib/admin-dashboard-stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activityLimit = Math.min(
      Math.max(Number.parseInt(searchParams.get("activityLimit") || "5", 10), 1),
      100,
    );

    try {
      await syncAffiliateCommissionStatuses(pool, {
        logPrefix: "[Admin Dashboard]",
      });
    } catch (err) {
      console.warn("[Admin Dashboard] status sync failed:", err);
    }

    const [stats, adminStats, commissionRates, activities] = await Promise.all([
      fetchAffiliateDashboardStats(pool),
      fetchAdminRoleStats(pool),
      fetchCommissionRates(pool),
      buildNationalActivities(pool, activityLimit),
    ]);

    return NextResponse.json({
      success: true,
      stats,
      adminStats,
      rates: commissionRates.rates,
      activities,
    });
  } catch (error) {
    console.error("Failed to fetch admin dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
