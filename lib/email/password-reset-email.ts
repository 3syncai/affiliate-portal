import { getAppBaseUrl, getLoginUrl, getResetPasswordUrl } from "@/lib/app-url"
import { sendMail } from "@/lib/email/smtp"

type PasswordResetEmailInput = {
  to: string
  displayName: string
  resetToken: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<void> {
  const baseUrl = getAppBaseUrl()
  const logoUrl = `${baseUrl}/uploads/coin/Oweg3d-400.png`
  const resetUrl = getResetPasswordUrl(input.resetToken)
  const loginUrl = getLoginUrl()
  const safeName = escapeHtml(input.displayName)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="text-align: center; padding: 24px 0;">
        <img src="${logoUrl}" alt="OWEG" width="120" style="display: block; margin: 0 auto;" />
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Reset your password</h1>
        <p style="margin: 0 0 16px; color: #475569; line-height: 1.5;">
          Hi ${safeName}, we received a request to reset your OWEG Partner Portal password.
        </p>
        <p style="margin: 0 0 20px; color: #475569; line-height: 1.5;">
          Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>
          and can be used <strong>only once</strong>.
        </p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}"
             style="display: inline-block; background: #059669; color: #fff; text-decoration: none;
                    padding: 12px 24px; border-radius: 8px; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href="${resetUrl}" style="color: #059669;">${resetUrl}</a>
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
        If you did not request this, you can ignore this email. Your password will not change.
        After resetting, sign in at <a href="${loginUrl}" style="color: #059669;">${loginUrl}</a>.
      </p>
    </div>
  `

  const text = [
    `Hi ${input.displayName},`,
    "",
    "Reset your OWEG Partner Portal password using this link (valid 15 minutes, one-time use):",
    resetUrl,
    "",
    `If you did not request this, ignore this email. Sign in: ${loginUrl}`,
  ].join("\n")

  await sendMail({
    to: input.to,
    subject: "Reset your OWEG Partner Portal password",
    html,
    text,
  })
}
