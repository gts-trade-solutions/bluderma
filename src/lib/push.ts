import "server-only";

import webpush from "web-push";

import { prisma } from "@/lib/prisma";

/**
 * Sending a browser notification.
 *
 * ── What may go in one, and what may not ─────────────────────────────────
 * A push notification lands on a lock screen, in front of whoever happens to
 * be holding the phone. So the payload carries a time, a practitioner's name
 * and a link, and never a procedure, a diagnosis, a medicine or a body site.
 * "Your acne scarring review is at 4pm" is a disclosure nobody consented to
 * by tapping Allow, and the person who reads it may not be the patient.
 *
 * The rule is enforced by the shape of `PushPayload` rather than by
 * remembering: there is no field to put a procedure in.
 *
 * ── Dead subscriptions are deleted, and only on the two codes that mean it ─
 * A push service answers 404 or 410 when a subscription has genuinely gone —
 * the browser was uninstalled, the permission revoked, the site data cleared.
 * Those rows are removed, because retrying them forever is the only other
 * option. A 500 from the push service is their outage, not evidence that this
 * browser no longer exists, and deleting on it would quietly unsubscribe
 * everybody during somebody else's bad afternoon.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping it goes. Same-origin path. */
  url: string;
  /** Groups replacements: a second reminder for one booking replaces the first. */
  tag?: string;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

let ready = false;

function configure(): boolean {
  if (!pushConfigured()) return false;
  if (ready) return true;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:info@bluderma.kr",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  ready = true;
  return true;
}

export interface PushOutcome {
  sent: number;
  /** Subscriptions removed because the browser is gone. */
  pruned: number;
  /** Failures worth looking at. A transient outage, usually. */
  failed: number;
}

/**
 * Sends to every browser this person has allowed.
 *
 * One person is several subscriptions — a phone and a laptop are two rows,
 * and clearing site data makes a third — so this is deliberately a fan-out
 * rather than a single send. Somebody who allowed notifications on their
 * phone and reads them on a laptop should get it in both places.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushOutcome> {
  const out: PushOutcome = { sent: 0, pruned: 0, failed: 0 };
  if (!configure()) return out;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return out;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          // Long enough to survive a phone that is asleep, short enough that
          // a reminder never arrives after the appointment it is about.
          { TTL: 6 * 60 * 60 }
        );
        out.sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          dead.push(s.id);
          out.pruned++;
        } else {
          out.failed++;
          console.error("push failed", code, (e as Error).message);
        }
      }
    })
  );

  if (dead.length) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: dead } } })
      .catch((e) => console.error("push prune failed", e));
  }
  if (out.sent > 0) {
    await prisma.pushSubscription
      .updateMany({
        where: { userId, id: { notIn: dead } },
        data: { lastSentAt: new Date() },
      })
      .catch(() => undefined);
  }

  return out;
}
