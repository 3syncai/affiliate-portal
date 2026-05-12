import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const normalize = (value: unknown) => String(value ?? "").trim();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const referCode = searchParams.get("refer_code");

    if (!referCode) {
      return NextResponse.json(
        { success: false, error: "Affiliate code required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT * FROM affiliate_user WHERE refer_code = $1 LIMIT 1`,
      [referCode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Affiliate not found" },
        { status: 404 }
      );
    }

    const row = result.rows[0] || {};
    return NextResponse.json({
      success: true,
      profile: {
        id: row.id ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        refer_code: row.refer_code ?? referCode,
        branch: row.branch ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        role: row.role ?? null,
        is_approved: Boolean(row.is_approved ?? false),
        is_active: Boolean(row.is_active ?? true),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch affiliate profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch affiliate profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      referCode,
      first_name,
      last_name,
      email,
      phone,
      currentPassword,
      newPassword,
    } = body || {};

    if (!referCode) {
      return NextResponse.json(
        { success: false, error: "Affiliate code required" },
        { status: 400 }
      );
    }

    const existingResult = await pool.query(
      `SELECT id, first_name, last_name, email, phone, password_hash,
              branch, city, state
       FROM affiliate_user
       WHERE refer_code = $1
       LIMIT 1`,
      [referCode]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Affiliate not found" },
        { status: 404 }
      );
    }

    const existing = existingResult.rows[0];

    // Email uniqueness check (if changed)
    if (email && normalize(email).toLowerCase() !== normalize(existing.email).toLowerCase()) {
      const conflict = await pool.query(
        `SELECT id FROM affiliate_user WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
        [normalize(email), existing.id]
      );
      if (conflict.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: "This email is already in use by another account" },
          { status: 409 }
        );
      }
    }

    // Password change handling
    let nextPasswordHash: string | null = null;
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: "Both current and new password are required to change password" },
          { status: 400 }
        );
      }
      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { success: false, error: "New password must be at least 6 characters" },
          { status: 400 }
        );
      }
      const valid = await bcrypt.compare(currentPassword, existing.password_hash);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 401 }
        );
      }
      nextPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    // Detect which profile fields changed (excluding password)
    const changedFields: string[] = [];
    if (first_name !== undefined && normalize(first_name) !== normalize(existing.first_name)) {
      changedFields.push("first name");
    }
    if (last_name !== undefined && normalize(last_name) !== normalize(existing.last_name)) {
      changedFields.push("last name");
    }
    if (email !== undefined && normalize(email).toLowerCase() !== normalize(existing.email).toLowerCase()) {
      changedFields.push("email");
    }
    if (phone !== undefined && normalize(phone) !== normalize(existing.phone)) {
      changedFields.push("phone");
    }

    // Build dynamic UPDATE
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (first_name !== undefined) {
      sets.push(`first_name = $${idx++}`);
      values.push(normalize(first_name));
    }
    if (last_name !== undefined) {
      sets.push(`last_name = $${idx++}`);
      values.push(normalize(last_name));
    }
    if (email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(normalize(email));
    }
    if (phone !== undefined) {
      sets.push(`phone = $${idx++}`);
      values.push(normalize(phone));
    }
    if (nextPasswordHash) {
      sets.push(`password_hash = $${idx++}`);
      values.push(nextPasswordHash);
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1 /* only updated_at */) {
      return NextResponse.json(
        { success: false, error: "No changes provided" },
        { status: 400 }
      );
    }

    values.push(referCode);
    const updateSql = `UPDATE affiliate_user SET ${sets.join(", ")} WHERE refer_code = $${idx}
                       RETURNING id, first_name, last_name, email, phone, refer_code,
                                 branch, city, state, is_approved,
                                 created_at, updated_at`;

    const updated = await pool.query(updateSql, values);
    const updatedRow = updated.rows[0];

    // Notify branch admin(s) only if name / email / phone changed
    if (changedFields.length > 0) {
      try {
        const branchRecipients = await pool.query(
          `SELECT DISTINCT ba.id::text AS recipient_id
           FROM branch_admin ba
           WHERE ba.is_active = true
             AND (
               LOWER(TRIM(COALESCE(ba.branch, ''))) = LOWER(TRIM(COALESCE($1, '')))
               OR (
                 LOWER(TRIM(COALESCE(ba.city, ''))) = LOWER(TRIM(COALESCE($2, '')))
                 AND LOWER(TRIM(COALESCE(ba.state, ''))) = LOWER(TRIM(COALESCE($3, '')))
               )
               OR LOWER(TRIM(COALESCE(ba.state, ''))) = LOWER(TRIM(COALESCE($3, '')))
             )`,
          [
            existing.branch || "",
            existing.city || "",
            existing.state || "",
          ]
        );

        let recipients = branchRecipients.rows;
        if (recipients.length === 0) {
          const fallback = await pool.query(
            `SELECT DISTINCT ba.id::text AS recipient_id
             FROM branch_admin ba
             WHERE ba.is_active = true`
          );
          recipients = fallback.rows;
        }

        if (recipients.length > 0) {
          const newName =
            `${updatedRow.first_name || ""} ${updatedRow.last_name || ""}`.trim() ||
            referCode;
          const regionLabel = [updatedRow.branch, updatedRow.city, updatedRow.state]
            .filter(Boolean)
            .join(", ");
          const fieldList =
            changedFields.length === 1
              ? changedFields[0]
              : `${changedFields.slice(0, -1).join(", ")} and ${changedFields[changedFields.length - 1]}`;
          const notificationMessage = `${newName} (${referCode})${regionLabel ? ` from ${regionLabel}` : ""} updated their ${fieldList}.`;

          await Promise.all(
            recipients.map((recipient: { recipient_id: string }) =>
              pool.query(
                `INSERT INTO notifications (
                   recipient_id, recipient_role,
                   sender_id, sender_role,
                   message, type, is_read
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  recipient.recipient_id,
                  "branch",
                  existing.id,
                  "affiliate",
                  notificationMessage,
                  "alert",
                  false,
                ]
              )
            )
          );
        }
      } catch (notifyError) {
        // Notification failure must not fail the profile update.
        console.error("Failed to notify branch for profile change:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: updatedRow.id,
        first_name: updatedRow.first_name,
        last_name: updatedRow.last_name,
        email: updatedRow.email,
        phone: updatedRow.phone,
        refer_code: updatedRow.refer_code,
        branch: updatedRow.branch,
        city: updatedRow.city,
        state: updatedRow.state,
        is_approved: Boolean(updatedRow.is_approved),
        is_active: Boolean(updatedRow.is_active ?? true),
        created_at: updatedRow.created_at,
        updated_at: updatedRow.updated_at,
      },
      changedFields,
      passwordChanged: Boolean(nextPasswordHash),
    });
  } catch (error) {
    console.error("Failed to update affiliate profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update affiliate profile" },
      { status: 500 }
    );
  }
}
