import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { uploadAffiliateDocument } from "@/lib/s3-upload";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()

        // Extract form fields
        const refer_code = formData.get("refer_code") as string
        const entry_sponsor = formData.get("entry_sponsor") as string
        const is_agent = formData.get("is_agent") === "true"
        const first_name = formData.get("first_name") as string
        const last_name = formData.get("last_name") as string
        const email = formData.get("email") as string
        const phone = formData.get("phone") as string
        const gender = formData.get("gender") as string
        const father_name = formData.get("father_name") as string
        const mother_name = formData.get("mother_name") as string
        const birth_date = formData.get("birth_date") as string
        const qualification = formData.get("qualification") as string
        const marital_status = formData.get("marital_status") as string
        const blood_group = formData.get("blood_group") as string
        const emergency_person_name = formData.get("emergency_person_name") as string
        const emergency_person_mobile = formData.get("emergency_person_mobile") as string
        const aadhar_card_no = formData.get("aadhar_card_no") as string
        const pan_card_no = formData.get("pan_card_no") as string
        const designation = formData.get("designation") as string
        const sales_target = formData.get("sales_target") as string
        const branch = formData.get("branch") as string
        const area = formData.get("area") as string
        const state = formData.get("state") as string
        const payment_method = formData.get("payment_method") as string
        const bank_name = formData.get("bank_name") as string
        const bank_branch = formData.get("bank_branch") as string
        const ifsc_code = formData.get("ifsc_code") as string
        const account_name = formData.get("account_name") as string
        const account_number = formData.get("account_number") as string
        const upi_id = formData.get("upi_id") as string
        const address_1 = formData.get("address_1") as string
        const address_2 = formData.get("address_2") as string
        const city = formData.get("city") as string
        const pin_code = formData.get("pin_code") as string
        const country = formData.get("country") as string
        const address_state = formData.get("address_state") as string
        const password = formData.get("password") as string

        // Validate required fields
        if (!first_name || !last_name || !email || !phone || !password) {
            return NextResponse.json(
                { success: false, message: "Required fields are missing" },
                { status: 400 }
            )
        }

        // Handle file uploads to S3
        // Check for pre-uploaded S3 URLs (from instant upload) or File objects
        const aadhar_card_photo_url = formData.get("aadhar_card_photo_url") as string | null
        const pan_card_photo_url = formData.get("pan_card_photo_url") as string | null
        const aadhar_card_photo = formData.get("aadhar_card_photo") as File | null
        const pan_card_photo = formData.get("pan_card_photo") as File | null

        let aadhar_photo_path: string | null = aadhar_card_photo_url || null
        let pan_photo_path: string | null = pan_card_photo_url || null

        // Create username from email (before @ symbol)
        const username = email.split("@")[0]

        // If URLs not provided but files are, upload them (fallback for backwards compatibility)
        if (!aadhar_photo_path && aadhar_card_photo) {
            try {
                console.log(`[S3 Upload] Uploading Aadhar card for ${username}...`)
                aadhar_photo_path = await uploadAffiliateDocument(aadhar_card_photo, username, "aadhar")
                console.log(`[S3 Upload] Aadhar uploaded successfully to: ${aadhar_photo_path}`)
            } catch (error) {
                console.error("[S3 Upload] Failed to upload Aadhar card:", error)
                return NextResponse.json(
                    { success: false, message: "Failed to upload Aadhar card photo", error: error instanceof Error ? error.message : "Unknown error" },
                    { status: 500 }
                )
            }
        }

        if (!pan_photo_path && pan_card_photo) {
            try {
                console.log(`[S3 Upload] Uploading PAN card for ${username}...`)
                pan_photo_path = await uploadAffiliateDocument(pan_card_photo, username, "pancard")
                console.log(`[S3 Upload] PAN uploaded successfully to: ${pan_photo_path}`)
            } catch (error) {
                console.error("[S3 Upload] Failed to upload PAN card:", error)
                return NextResponse.json(
                    { success: false, message: "Failed to upload PAN card photo", error: error instanceof Error ? error.message : "Unknown error" },
                    { status: 500 }
                )
            }
        }

        console.log(`[Registration] Photo paths - Aadhar: ${aadhar_photo_path}, PAN: ${pan_photo_path}`)

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Generate unique referral code: OWEG + first_name + 5 random digits
        const generateReferCode = () => {
            const randomDigits = Math.floor(10000 + Math.random() * 90000) // 5 random digits
            return `OWEG${first_name.toUpperCase()}${randomDigits}`
        }

        let generatedReferCode = generateReferCode()

        // Connect to database
        console.log("[Registration] Connecting to database...")
        console.log("[Registration] DATABASE_URL exists:", !!process.env.DATABASE_URL)
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        })

        // Check if email already exists
        const existingUser = await pool.query(
            "SELECT id FROM affiliate_user WHERE email = $1",
            [email]
        )

        if (existingUser.rows.length > 0) {
            await pool.end()
            return NextResponse.json(
                { success: false, message: "Email already registered" },
                { status: 400 }
            )
        }

        // Ensure unique refer code
        let codeExists = true
        while (codeExists) {
            const codeCheck = await pool.query(
                "SELECT id FROM affiliate_user WHERE refer_code = $1",
                [generatedReferCode]
            )
            if (codeCheck.rows.length === 0) {
                codeExists = false
            } else {
                generatedReferCode = generateReferCode()
            }
        }

        // Insert affiliate user (columns match database schema exactly)
        // Normalize branch, area, state, city names (First letter caps)
        const userId = crypto.randomUUID()
        const insertQuery = `
            INSERT INTO affiliate_user (
                id, first_name, last_name, email, password_hash, phone, refer_code, entry_sponsor,
                is_agent, gender, father_name, mother_name, birth_date, qualification,
                marital_status, blood_group, emergency_person_name, emergency_person_mobile,
                aadhar_card_no, pan_card_no, aadhar_card_photo, pan_card_photo, designation,
                sales_target, branch, area, state, payment_method, bank_name, bank_branch,
                ifsc_code, account_name, account_number, address_1, address_2, city, pin_code,
                country, address_state, upi_id, is_approved, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, INITCAP(LOWER($25)), INITCAP(LOWER($26)), INITCAP(LOWER($27)), $28, $29, $30, $31, $32,
                $33, $34, $35, INITCAP(LOWER($36)), $37, $38, INITCAP(LOWER($39)), $40, FALSE, NOW(), NOW()
            ) RETURNING id, email, first_name, last_name, refer_code, is_approved
        `

        const result = await pool.query(insertQuery, [
            userId,
            first_name,
            last_name,
            email,
            hashedPassword,
            phone,
            generatedReferCode,
            entry_sponsor || null,
            is_agent,
            gender || null,
            father_name || null,
            mother_name || null,
            birth_date || null,
            qualification || null,
            marital_status || null,
            blood_group || null,
            emergency_person_name || null,
            emergency_person_mobile || null,
            aadhar_card_no || null,
            pan_card_no || null,
            aadhar_photo_path,
            pan_photo_path,
            designation || null,
            sales_target || null,
            branch || null,
            area || null,
            state || null,
            payment_method || "Bank Transfer",
            bank_name || null,
            bank_branch || null,
            ifsc_code || null,
            account_name || null,
            account_number || null,
            address_1 || null,
            address_2 || null,
            city || null,
            pin_code || null,
            country || null,
            address_state || null,
            upi_id || null
        ])

        await pool.end()

        const user = result.rows[0]

        return NextResponse.json({
            success: true,
            message: "Registration successful! Your application is pending verification.",
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                refer_code: user.refer_code,
                is_approved: user.is_approved
            }
        })

    } catch (error: any) {
        console.error("Registration error:", error)
        console.error("Error stack:", error?.stack)
        console.error("Error code:", error?.code)
        console.error("Error detail:", error?.detail)
        return NextResponse.json(
            {
                success: false,
                message: "Registration failed",
                error: error instanceof Error ? error.message : "Unknown error",
                detail: error?.detail || null,
                code: error?.code || null
            },
            { status: 500 }
        )
    }
}
