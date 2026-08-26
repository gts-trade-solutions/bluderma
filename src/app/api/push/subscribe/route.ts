import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Registering a browser for appointment reminders, and unregistering it.
 *
 * ── Why the endpoint is upserted rather than inserted ────────────────────
 * A browser re-subscribes on its own initiative: after a service-worker
 * update, after the push service rotates its keys, sometimes on a whim. Each
 * time it hands back the same endpoint. Inserting would fail on the unique;
 * inserting-if-missing would leave the row pointing at stale encryption keys
 * and every send would fail silently from then on. So the keys are written
 * every time.
 *
 * ── Why the row can move between users ───────────────────────────────────
 * One browser, two people — a shared laptop, a clinic front desk. If the
 * endpoint already exists under somebody else, it is REASSIGNED to whoever is
 * signed in now, because the alternative is sending this person's appointment
 * reminders to the previous account's subscription. Signing out clears it
 * properly, and this is the safety net for when somebody does not.
 */

const subscribeSchema = z.object({
  endpoint: z.string().trim().url().max(500),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(400),
    auth: z.string().trim().min(1).max(400),
  }),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!pushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 }
    );
  }

  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint: d.endpoint },
    create: {
      userId: user.id,
      endpoint: d.endpoint,
      p256dh: d.keys.p256dh,
      auth: d.keys.auth,
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    },
    update: {
      // Both, deliberately. See the note above: a stale key pair is a
      // subscription that fails silently forever.
      userId: user.id,
      p256dh: d.keys.p256dh,
      auth: d.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Turning them off.
 *
 * Scoped to the signed-in user as well as the endpoint: without that, anyone
 * who learned an endpoint could unsubscribe somebody else from their
 * reminders.
 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const parsed = z
    .object({ endpoint: z.string().trim().max(500) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
