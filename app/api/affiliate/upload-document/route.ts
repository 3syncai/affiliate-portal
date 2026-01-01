import { NextRequest, NextResponse } from "next/server"
import { uploadAffiliateDocument } from "@/lib/s3-upload"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const email = formData.get("email") as string
        const docType = formData.get("docType") as "aadhar" | "pancard"

        if (!file) {
            return NextResponse.json(
                { success: false, message: "No file provided" },
                { status: 400 }
            )
        }

        if (!email) {
            return NextResponse.json(
                { success: false, message: "Email is required" },
                { status: 400 }
            )
        }

        if (!docType || (docType !== "aadhar" && docType !== "pancard")) {
            return NextResponse.json(
                { success: false, message: "Invalid document type" },
                { status: 400 }
            )
        }

        // Create username from email
        const username = email.split("@")[0]

        console.log(`[S3 Upload] Uploading ${docType} for ${username}...`)
        console.log(`[S3 Upload] File: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`)

        // Upload to S3
        const s3Url = await uploadAffiliateDocument(file, username, docType)

        console.log(`[S3 Upload] ✓ ${docType} uploaded successfully to: ${s3Url}`)

        return NextResponse.json({
            success: true,
            message: `${docType === "aadhar" ? "Aadhar" : "PAN"} card uploaded successfully!`,
            url: s3Url,
            filename: file.name
        })

    } catch (error) {
        console.error("[S3 Upload] ✗ Upload failed:", error)
        return NextResponse.json(
            {
                success: false,
                message: "Failed to upload file to S3",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        )
    }
}
