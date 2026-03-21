import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAdditionalCommissionSchema, normalizeVisibilityRole } from "@/lib/additional-commission";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureAdditionalCommissionSchema();

    const result = await pool.query(`
      SELECT
        id,
        product_id,
        product_name,
        additional_rate,
        target_role,
        starts_at,
        ends_at,
        is_active,
        created_by,
        created_at,
        updated_at,
        CASE
          WHEN is_active = false THEN 'INACTIVE'
          WHEN starts_at > NOW() THEN 'UPCOMING'
          WHEN ends_at IS NOT NULL AND ends_at < NOW() THEN 'ENDED'
          ELSE 'ACTIVE'
        END AS runtime_status
      FROM additional_commissions
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      campaigns: result.rows,
    });
  } catch (error) {
    console.error("Failed to load additional commissions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load additional commissions",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAdditionalCommissionSchema();

    const body = await req.json();
    const productId = String(body?.productId || "").trim();
    const productName = String(body?.productName || "").trim() || null;
    const additionalRate = Number(body?.additionalRate);
    const startsAt = String(body?.startsAt || "").trim();
    const endsAtRaw = String(body?.endsAt || "").trim();
    const targetRole = normalizeVisibilityRole(body?.targetRole);
    const createdBy = String(body?.createdBy || "").trim() || null;

    if (!productId) {
      return NextResponse.json({ success: false, error: "Product is required" }, { status: 400 });
    }

    if (!Number.isFinite(additionalRate) || additionalRate < 0) {
      return NextResponse.json({ success: false, error: "Additional commission must be 0 or greater" }, { status: 400 });
    }

    if (!startsAt) {
      return NextResponse.json({ success: false, error: "Start time is required" }, { status: 400 });
    }

    const startDate = new Date(startsAt);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid start time" }, { status: 400 });
    }

    let endDate: Date | null = null;
    if (endsAtRaw) {
      endDate = new Date(endsAtRaw);
      if (Number.isNaN(endDate.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid end time" }, { status: 400 });
      }
      if (endDate <= startDate) {
        return NextResponse.json({ success: false, error: "End time must be after start time" }, { status: 400 });
      }
    }

    const insertResult = await pool.query(
      `
        INSERT INTO additional_commissions (
          product_id,
          product_name,
          additional_rate,
          target_role,
          starts_at,
          ends_at,
          is_active,
          created_by,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW())
        RETURNING *
      `,
      [productId, productName, additionalRate, targetRole, startDate.toISOString(), endDate ? endDate.toISOString() : null, createdBy]
    );

    return NextResponse.json({
      success: true,
      campaign: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to create additional commission:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create additional commission",
      },
      { status: 500 }
    );
  }
}
