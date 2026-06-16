import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
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

        const pool = new Pool({
            connectionString:
                process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        await syncAffiliateCommissionStatuses(pool, {
            logPrefix: "[National Activity]",
        });

        const activities = await buildNationalActivities(pool, limit);

        await pool.end();

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
