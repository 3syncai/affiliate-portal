import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic"

export async function GET() {
    console.log("=== Fetching Affiliate Users ===");

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log("Database connected");

        // Fetch all affiliate users - only query columns that definitely exist
        const query = `
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone,
                refer_code,
                entry_sponsor,
                is_agent,
                is_approved,
                gender,
                father_name,
                mother_name,
                birth_date,
                qualification,
                marital_status,
                blood_group,
                emergency_person_name,
                emergency_person_mobile,
                aadhar_card_no,
                pan_card_no,
                aadhar_card_photo,
                pan_card_photo,
                designation,
                sales_target,
                branch,
                area,
                state,
                payment_method,
                bank_name,
                bank_branch,
                ifsc_code,
                account_name,
                account_number,
                upi_id,
                address_1,
                address_2,
                city,
                pin_code,
                country,
                address_state,
                created_at,
                updated_at
            FROM affiliate_user
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} total users`);

        await pool.end();

        // Separate pending (not approved) and approved users
        const pending = result.rows.filter(user => !user.is_approved);
        const approved = result.rows.filter(user => user.is_approved);

        console.log(`Pending: ${pending.length}, Approved: ${approved.length}`);

        return NextResponse.json({
            success: true,
            users: result.rows,
            pending,
            approved,
            count: result.rows.length
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Failed to fetch affiliate users:", err);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch affiliate users",
                message: err.message
            },
            { status: 500 }
        );
    }
}
