import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAdditionalCommissionSchema, normalizeVisibilityRole } from "@/lib/additional-commission";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await ensureAdditionalCommissionSchema();

    const { id } = await params;
    const body = await req.json();

    const payload: {
      additionalRate?: number;
      startsAt?: string;
      endsAt?: string | null;
      targetRole?: string;
      isActive?: boolean;
      productName?: string;
    } = body || {};

    const updates: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (payload.additionalRate !== undefined) {
      const rate = Number(payload.additionalRate);
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ success: false, error: "Invalid additional commission rate" }, { status: 400 });
      }
      updates.push(`additional_rate = $${index++}`);
      values.push(rate);
    }

    if (payload.startsAt !== undefined) {
      const startDate = new Date(payload.startsAt);
      if (Number.isNaN(startDate.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid start time" }, { status: 400 });
      }
      updates.push(`starts_at = $${index++}`);
      values.push(startDate.toISOString());
    }

    if (payload.endsAt !== undefined) {
      if (payload.endsAt === null || String(payload.endsAt).trim() === "") {
        updates.push(`ends_at = NULL`);
      } else {
        const endDate = new Date(payload.endsAt);
        if (Number.isNaN(endDate.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid end time" }, { status: 400 });
        }
        updates.push(`ends_at = $${index++}`);
        values.push(endDate.toISOString());
      }
    }

    if (payload.targetRole !== undefined) {
      updates.push(`target_role = $${index++}`);
      values.push(normalizeVisibilityRole(payload.targetRole));
    }

    if (payload.productName !== undefined) {
      updates.push(`product_name = $${index++}`);
      values.push(String(payload.productName || "").trim() || null);
    }

    if (payload.isActive !== undefined) {
      updates.push(`is_active = $${index++}`);
      values.push(Boolean(payload.isActive));
    }

    if (!updates.length) {
      return NextResponse.json({ success: false, error: "No fields provided to update" }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(Number(id));

    const result = await pool.query(
      `
        UPDATE additional_commissions
        SET ${updates.join(", ")}
        WHERE id = $${index}
        RETURNING *
      `,
      values
    );

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: "Additional commission not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      campaign: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to update additional commission:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update additional commission",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await ensureAdditionalCommissionSchema();
    const { id } = await params;

    const result = await pool.query(
      `
        DELETE FROM additional_commissions
        WHERE id = $1
        RETURNING id
      `,
      [Number(id)]
    );

    if (!result.rows.length) {
      return NextResponse.json({ success: false, error: "Additional commission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete additional commission:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete additional commission",
      },
      { status: 500 }
    );
  }
}
