import { EmailStatus } from "@prisma/client";
import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

import { prisma } from "./prisma";

/**
 * Transport-agnostic mail helper.
 *
 * Delivery is AWS SES (v2), reusing the same AWS credentials as the S3 uploads.
 * When SES isn't configured yet, every send is still recorded in `email_logs`
 * and printed to the server console, so the reset and booking flows stay
 * testable without a mail provider. Callers never change when the transport
 * flips on.
 *
 * SES prerequisites (do before flipping this on in production):
 *  - Verify the EMAIL_FROM address or its domain in the SES console.
 *  - While the account is in the SES sandbox, verify every recipient too, or
 *    request production access to send to arbitrary addresses.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Identifies the template for logging, e.g. "password-reset". */
  template: string;
  html: string;
  text?: string;
  /** Domain row this email relates to (appointment id, user id, …). */
  relatedId?: string;
}

/**
 * SES credentials are resolved independently of S3's. A dedicated SES key pair
 * (SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY) is preferred so email can be
 * scoped to a send-only IAM user; it falls back to the shared AWS_* keys when a
 * single credential set covers both. Region and from-address have the same
 * SES-specific → shared fallback.
 */
function sesConfig() {
  return {
    region: process.env.SES_REGION || process.env.AWS_REGION,
    accessKeyId:
      process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    from: process.env.EMAIL_FROM || process.env.AWS_FROM_EMAIL,
  };
}

export function isEmailConfigured(): boolean {
  const c = sesConfig();
  return !!(c.region && c.accessKeyId && c.secretAccessKey && c.from);
}

/** The verified SES identity emails are sent from. */
export function emailFrom(): string | undefined {
  return sesConfig().from;
}

let client: SESv2Client | undefined;

function ses(): SESv2Client {
  const c = sesConfig();
  return (client ??= new SESv2Client({
    region: c.region!,
    credentials: {
      accessKeyId: c.accessKeyId!,
      secretAccessKey: c.secretAccessKey!,
    },
  }));
}

async function deliver(input: SendEmailInput): Promise<string | null> {
  if (!isEmailConfigured()) {
    // Dev fallback: no provider wired, so surface the mail on the console for
    // local testing. The body is only printed in development — a password-reset
    // body contains the raw token, and if a production deploy ever runs without
    // SES configured we must not leak valid tokens into server logs.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[email] SES not configured, dropping ${input.template} to ${input.to} (body withheld). Configure EMAIL_FROM + AWS creds.`
      );
    } else {
      console.info(
        `\n[email:dev] to=${input.to} template=${input.template}\n${
          input.text ?? input.html
        }\n`
      );
    }
    return null;
  }

  const command = new SendEmailCommand({
    FromEmailAddress: sesConfig().from,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          ...(input.text
            ? { Text: { Data: input.text, Charset: "UTF-8" } }
            : {}),
        },
      },
    },
  });

  const res = await ses().send(command);
  return res.MessageId ?? null;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const log = await prisma.emailLog.create({
    data: {
      to: input.to,
      subject: input.subject,
      template: input.template,
      relatedId: input.relatedId ?? null,
      status: EmailStatus.QUEUED,
    },
  });

  try {
    const providerId = await deliver(input);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: EmailStatus.SENT, sentAt: new Date(), providerId },
    });
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/** Where new-enquiry notifications are sent. Overridable via env. */
export function enquiryNotifyAddress(): string {
  return process.env.ENQUIRY_NOTIFY_EMAIL || "info@bluderma.kr";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Internal notification sent to the business when an enquiry comes in. */
export function enquiryNotificationEmail(e: {
  audience: string;
  name: string;
  email: string;
  phone?: string | null;
  organisation?: string | null;
  quantity?: number | null;
  productName?: string | null;
  treatmentName?: string | null;
  message?: string | null;
  source: string;
}) {
  const isDoctor = e.audience === "DOCTOR";
  const rows: [string, string | null | undefined][] = [
    ["Audience", isDoctor ? "Doctor" : "Consultation"],
    ["Name", e.name],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Organisation", e.organisation],
    ["Product", e.productName],
    ["Treatment", e.treatmentName],
    ["Quantity", e.quantity != null ? String(e.quantity) : null],
    ["Message", e.message],
    ["Source", e.source],
  ];
  const shown = rows.filter(([, v]) => v != null && v !== "");

  const text =
    `New enquiry received via BluDerma.\n\n` +
    shown.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n`;

  const htmlRows = shown
    .map(
      ([k, v]) =>
        `<tr><td style="padding:5px 14px 5px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(
          k
        )}</td><td style="padding:5px 0;font-size:14px;color:#0f172a">${escapeHtml(
          String(v)
        )}</td></tr>`
    )
    .join("");

  return {
    subject: `New ${isDoctor ? "doctor" : "consultation"} enquiry from ${e.name}`,
    text,
    html: `
      <p style="font-size:15px;color:#0f172a">New enquiry received via BluDerma.</p>
      <table style="border-collapse:collapse;margin-top:8px">${htmlRows}</table>
      <p style="color:#64748b;font-size:13px;margin-top:16px">Reply directly to ${escapeHtml(
        e.email
      )} to follow up.</p>
    `,
  };
}

export function passwordResetEmail(name: string | null, url: string) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Reset your BluDerma password",
    text: `${greeting}\n\nUse the link below to choose a new password. It expires in 60 minutes.\n\n${url}\n\nIf you didn't ask for this, you can ignore this email, your password won't change.\n\nBluDerma`,
    html: `
      <p>${greeting}</p>
      <p>Use the link below to choose a new password. It expires in 60 minutes.</p>
      <p><a href="${url}">Reset my password</a></p>
      <p style="color:#64748b;font-size:13px">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
      <p style="color:#64748b;font-size:13px">BluDerma</p>
    `,
  };
}
