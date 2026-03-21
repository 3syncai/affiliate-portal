import { NextRequest, NextResponse } from "next/server";
import {
  fetchActiveAdditionalCommissionsForRole,
  normalizeVisibilityRole,
  type AdditionalVisibilityRole,
} from "@/lib/additional-commission";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get("role");
    const role = normalizeVisibilityRole(roleParam) as AdditionalVisibilityRole;
    const rows = await fetchActiveAdditionalCommissionsForRole(role);

    return NextResponse.json({
      success: true,
      role,
      campaigns: rows,
    });
  } catch (error) {
    console.error("Failed to fetch active additional commissions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch active additional commissions",
      },
      { status: 500 }
    );
  }
}
