import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { buildStateAdminActivities } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const state = searchParams.get("state");
        const adminId = searchParams.get("adminId");
        const limit = Math.min(
            Math.max(Number.parseInt(searchParams.get("limit") || "15", 10), 1),
            100,
        );

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


        const activities = await buildStateAdminActivities(
            pool,
            { state, adminId: adminId || undefined },
            limit,
        );

        await pool.end();

        return NextResponse.json({
            success: true,
            activities,
            count: activities.length,
        });
    } catch (error: unknown) {
        console.error("Failed to fetch recent activities:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                activities: [],
            },
            { status: 500 },
        );
    }
}
