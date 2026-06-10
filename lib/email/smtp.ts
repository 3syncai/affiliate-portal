import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let cachedTransport: nodemailer.Transporter | null = null;

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD,
  );
}

function getTransport(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;

  const port = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return cachedTransport;
}

function getFromAddress(): Mail.Options["from"] {
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const name = process.env.SMTP_FROM_NAME || "OWEG";

  if (!email) {
    throw new Error("SMTP_FROM_EMAIL or SMTP_USER is required");
  }

  return { name, address: email };
}

export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP not configured — skipping send to", input.to);
    return;
  }

  const transport = getTransport();

  await transport.sendMail({
    from: getFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
