import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

// Hardcoded credentials (environment variables not loading properly)
const S3_ACCESS_KEY = "AKIAUWCNHNZY5V45HBOM"
const S3_SECRET_KEY = "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"
const S3_REGION_NAME = "ap-south-1"
const S3_BUCKET_NAME = "oweg-product-images"

const s3Client = new S3Client({
    region: S3_REGION_NAME,
    credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
    },
})

export async function uploadToS3(
    file: File,
    folder: string,
    filename: string
): Promise<string> {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const key = `${folder}/${filename}`

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
    })

    await s3Client.send(command)

    // Return the S3 URL
    return `https://${S3_BUCKET_NAME}.s3.${S3_REGION_NAME}.amazonaws.com/${key}`
}

/**
 * Upload affiliate documents to S3
 * @param file - The file to upload
 * @param username - The affiliate's username/email
 * @param docType - Type of document ('aadhar' or 'pancard')
 * @returns S3 URL of the uploaded file
 */
export async function uploadAffiliateDocument(
    file: File,
    username: string,
    docType: "aadhar" | "pancard"
): Promise<string> {
    const folder = `affiliate/${username}`
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `${docType}.${extension}`

    return uploadToS3(file, folder, filename)
}
