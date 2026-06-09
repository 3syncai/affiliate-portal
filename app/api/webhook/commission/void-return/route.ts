import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { isApprovedReturnStatus } from "@/lib/return-request-status";
import { voidCommissionsForApprovedReturns } from "@/lib/void-return-commission";

export const dynamic = "force-dynamic";

/**
 * Called when Medusa admin approves a customer return. Immediately voids
 * affiliate commission, stops the post-delivery unlock timer, and reverses
 * any wallet credit that was applied at delivery.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const orderId = String(payload.order_id || "").trim();
    const returnStatus = payload.return_status ?? payload.status;

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Missing order_id" },
        { status: 400 },
      );
    }

    if (returnStatus && !isApprovedReturnStatus(returnStatus)) {
      return NextResponse.json({
        success: true,
        message: "Return not yet approved — commission unchanged",
        updated_count: 0,
      });
    }

    const updatedCount = await voidCommissionsForApprovedReturns(pool, {
      orderId,
      logPrefix: "[Webhook Return Void]",
    });

    return NextResponse.json({
      success: true,
      message:
        updatedCount > 0
          ? "Commission voided for approved return"
          : "No commission rows needed voiding",
      updated_count: updatedCount,
    });
  } catch (error) {
    console.error("[Webhook Return Void] failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
