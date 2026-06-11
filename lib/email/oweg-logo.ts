import fs from "fs"
import path from "path"
import type Mail from "nodemailer/lib/mailer"

export const OWEG_LOGO_CID = "oweg-logo"

function resolveLogoPath(): string {
  const configured = process.env.EMAIL_LOGO_PATH?.trim()
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured)
  }
  return path.join(process.cwd(), "public/uploads/coin/Oweg3d-400.png")
}

export function getOwegLogoAttachment(): Mail.Attachment | null {
  const logoPath = resolveLogoPath()
  if (!fs.existsSync(logoPath)) {
    console.warn("[email] OWEG logo not found at", logoPath)
    return null
  }

  return {
    filename: "oweg-logo.png",
    path: logoPath,
    cid: OWEG_LOGO_CID,
  }
}

export function getOwegLogoImgHtml(width = 88, height = 88): string {
  const attachment = getOwegLogoAttachment()
  if (!attachment) {
    return `<p style="margin:0 auto 16px;font-size:22px;font-weight:700;color:#059669;text-align:center;">OWEG</p>`
  }

  return `<img src="cid:${OWEG_LOGO_CID}" alt="OWEG" width="${width}" height="${height}" style="display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none;" />`
}

export function getOwegLogoAttachments(): Mail.Attachment[] {
  const attachment = getOwegLogoAttachment()
  return attachment ? [attachment] : []
}
