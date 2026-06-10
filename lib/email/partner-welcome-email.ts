import { getAppBaseUrl, getLoginUrl } from "@/lib/app-url";
import { sendMail } from "@/lib/email/smtp";

export type PartnerWelcomeRole =
  | "state_admin"
  | "branch_manager"
  | "area_sales_manager";

type PartnerWelcomeInput = {
  role: PartnerWelcomeRole;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  referCode: string;
  territory?: {
    state?: string;
    city?: string;
    branch?: string;
  };
};

const ROLE_LABELS: Record<
  PartnerWelcomeRole,
  { title: string; subject: string }
> = {
  state_admin: {
    title: "State Admin",
    subject: "Your OWEG Partner Portal — State Admin account",
  },
  branch_manager: {
    title: "Branch Manager",
    subject: "Your OWEG Partner Portal — Branch Manager account",
  },
  area_sales_manager: {
    title: "Area Sales Manager",
    subject: "Your OWEG Partner Portal — Area Sales Manager account",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function credentialLine(label: string, value: string, monospace = false) {
  const valueStyle = monospace
    ? "color:#0f172a;font-size:14px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;"
    : "color:#0f172a;font-size:14px;font-weight:600;";

  return `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;"><span style="color:#64748b;">${escapeHtml(label)}:</span>&nbsp;<span style="${valueStyle}">${escapeHtml(value)}</span></p>`;
}

function buildTerritoryLines(territory?: PartnerWelcomeInput["territory"]) {
  if (!territory) return "";

  const lines: string[] = [];
  if (territory.state) lines.push(credentialLine("State", territory.state));
  if (territory.city) lines.push(credentialLine("City", territory.city));
  if (territory.branch) lines.push(credentialLine("Branch", territory.branch));

  if (lines.length === 0) return "";

  return `<div style="margin-top:16px;">${lines.join("")}</div>`;
}

function buildHtml(input: PartnerWelcomeInput): string {
  const labels = ROLE_LABELS[input.role];
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const logoUrl = `${getAppBaseUrl()}/uploads/coin/Oweg3d-400.png`;
  const loginUrl = getLoginUrl();

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(labels.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg,#ecfdf5 0%,#ffffff 100%);">
                <img src="${logoUrl}" alt="OWEG" width="88" height="88" style="display:block;margin:0 auto 16px;" />
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">Welcome to OWEG Partner Portal</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">${escapeHtml(labels.title)} account created</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                  Hi ${escapeHtml(fullName)},
                </p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
                  Your ${escapeHtml(labels.title)} account has been created. Use the credentials below to sign in to the partner portal.
                </p>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
                  ${credentialLine("Role", labels.title)}
                  ${credentialLine("Partner ID", input.referCode, true)}
                  ${credentialLine("Login email", input.email)}
                  ${credentialLine("Password", input.password, true)}
                </div>

                ${buildTerritoryLines(input.territory)}

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 0;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:#059669;">
                      <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                        Login to Partner Portal
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                  Or copy this link:<br />
                  <a href="${loginUrl}" style="color:#059669;">${escapeHtml(loginUrl)}</a>
                </p>

                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  For security, change your password after your first login. If you did not expect this email, contact OWEG support.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">© OWEG · Partner Portal</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function buildText(input: PartnerWelcomeInput): string {
  const labels = ROLE_LABELS[input.role];
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const loginUrl = getLoginUrl();
  const territory = input.territory || {};

  const territoryLines = [
    territory.state ? `State: ${territory.state}` : "",
    territory.city ? `City: ${territory.city}` : "",
    territory.branch ? `Branch: ${territory.branch}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Welcome to OWEG Partner Portal`,
    ``,
    `Hi ${fullName},`,
    ``,
    `Your ${labels.title} account has been created.`,
    ``,
    `Role: ${labels.title}`,
    `Partner ID: ${input.referCode}`,
    `Login email: ${input.email}`,
    `Password: ${input.password}`,
    territoryLines,
    ``,
    `Login: ${loginUrl}`,
    ``,
    `Change your password after your first login.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function sendPartnerWelcomeEmail(
  input: PartnerWelcomeInput,
): Promise<boolean> {
  const labels = ROLE_LABELS[input.role];

  try {
    await sendMail({
      to: input.email,
      subject: labels.subject,
      html: buildHtml(input),
      text: buildText(input),
    });
    console.log(`[email] Partner welcome sent to ${input.email} (${input.role})`);
    return true;
  } catch (error) {
    console.error(
      `[email] Failed to send partner welcome to ${input.email}:`,
      error,
    );
    return false;
  }
}
