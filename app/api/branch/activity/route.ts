import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { syncAffiliateCommissionStatuses } from "@/lib/affiliate-commission-sync";
import { buildBranchAdminActivities } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branch = searchParams.get("branch");
        const adminId = searchParams.get("adminId");
        const limit = Math.min(
            Math.max(Number.parseInt(searchParams.get("limit") || "15", 10), 1),
            100,
        );

        if (!branch) {
            return NextResponse.json(
                { success: false, error: "Branch parameter is required" },
                { status: 400 },
            );
        }

        const pool = new Pool({
            connectionString:
                process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        await syncAffiliateCommissionStatuses(pool, {
            logPrefix: "[Branch Activity]",
        });

        const activities = await buildBranchAdminActivities(
            pool,
            { branch, adminId: adminId || undefined },
            limit,
        );

        await pool.end();

        return NextResponse.json({
            success: true,
            activities,
            count: activities.length,
        });
    } catch (error) {
        console.error("Failed to fetch branch activity:", error);
        return NextResponse.json(
            {
                success: false,
                activities: [],
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
