import { NextResponse } from "next/server";
import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getBookingPolicy } from "@/lib/booking/policySettings";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Sends the day-before reminder for upcoming appointments.
 *
 * Designed to be run on a schedule (Vercel Cron, or any external pinger)
 * hourly — the window is generous and `reminderSentAt` is stamped on the way
 * out, so running it more often than needed sends nothing twice and running
 * it late still catches the appointment.
 *
 * Protected by a shared secret rather than a session: it is a machine caller,
 * and without CRON_SECRET set the endpoint refuses rather than running open
 * to the internet. A reminder job anyone can trigger is a way to mail-bomb
 * your own patients.
 */

/** How far ahead to look. Anything inside this and not yet reminded gets one. */
const WINDOW_HOURS = 24;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }

  // Vercel Cron sends the Authorization header; a manual ping can use ?key=.
  const auth = req.headers.get("authorization") ?? "";
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3_600_000);

  const due = await prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.CONFIRMED,
      scheduledAt: { gte: now, lte: until },
      reminderSentAt: null,
    },
    take: 200,
    select: {
      id: true,
      scheduledAt: true,
      mode: true,
      patientName: true,
      patientEmail: true,
      doctor: { select: { name: true, clinic: true, location: true } },
    },
  });

  const policy = await getBookingPolicy();

  let sent = 0;
  let skipped = 0;

  for (const a of due) {
    if (!a.patientEmail) {
      // Nothing to send to, but stamp it so it stops being picked up.
      await prisma.appointment.update({
        where: { id: a.id },
        data: { reminderSentAt: now },
      });
      skipped += 1;
      continue;
    }

    const when = a.scheduledAt.toISOString().replace("T", " ").slice(0, 16);
    const where =
      a.mode === "VIDEO"
        ? "Video consult: your link follows separately"
        : a.mode === "HOME"
        ? "Home visit: the clinic will call to confirm the address"
        : `${a.doctor.clinic}, ${a.doctor.location}`;
    const changeLine = policy.receptionPhone
      ? `Need to change it? Call reception on ${policy.receptionPhone}, or manage it in your account.`
      : "Need to change it? You can manage it in your BluDerma account.";

    await sendEmail({
      to: a.patientEmail,
      template: "booking-confirmation",
      relatedId: a.id,
      subject: `Tomorrow: your appointment with ${a.doctor.name}`,
      text: `Hi ${a.patientName},\n\nThis is a reminder of your appointment with ${a.doctor.name} on ${when} (UTC).\nWhere: ${where}\n${changeLine}\n\n, BluDerma`,
      html: `<p>Hi ${a.patientName},</p><p>This is a reminder of your appointment with <strong>${a.doctor.name}</strong> on <strong>${when}</strong> (UTC).</p><p>Where: ${where}</p><p>${changeLine}</p><p>, BluDerma</p>`,
    }).catch((e) => console.error("reminder email failed", a.id, e));

    // Stamped whether or not the mail succeeded: the log records the failure,
    // and retrying a bad address every hour helps nobody.
    await prisma.appointment.update({
      where: { id: a.id },
      data: { reminderSentAt: now },
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, considered: due.length, sent, skipped });
}
