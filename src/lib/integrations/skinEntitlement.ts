import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Skin-analysis entitlement engine (BluDerma = authority).
 *
 * One `skin_entitlements` row per granted analysis; the row id IS the handoff
 * token's grant_id. Lifecycle:
 *
 *   available ──(reserve at Start)──► reserved ──(consume on success)──► consumed
 *                       ▲                   │
 *                       └──(release: TTL / failure)──┘   free scan preserved
 *
 * A brand-new user is lazily seeded with ONE free scan on first read/start.
 * Expired reservations auto-release on read (lazy expiry — no cron).
 */

export const RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 min ≫ max analysis time

export type SkinAccessState =
  | { status: "ready"; remaining: number }
  | { status: "reserved"; grantId: string }
  | { status: "none" };

/**
 * Hand back reservations whose TTL has passed.
 *
 * This used to set state "released", which quietly cost people the scan they
 * had never had. A reservation is a grant held aside for a handoff, and the
 * TTL exists to RETURN it when the handoff does not finish — a tab closed, a
 * selfie never taken, the analyzer failing. "released" is not a state anything
 * can spend: it is not "available", so the credit is gone, and yet it counts
 * as an entitlement row, so seedFreeIfNew sees somebody who has "had one" and
 * declines to seed another.
 *
 * The result was an account that had run no analysis at all being told "You've
 * used your available scan. Another is ₹99", with My Reports one click away
 * saying "No scans yet". Four real accounts were sitting in exactly that
 * state, having simply opened the analyzer and not finished within 30 minutes.
 *
 * So the row goes back to "available" — the state it was in before it was
 * reserved. `releasedAt` is still stamped, so the lapse is still legible.
 */
async function releaseExpired(userId: string): Promise<void> {
  await prisma.skinEntitlement.updateMany({
    where: { userId, state: "reserved", expiresAt: { lt: new Date() } },
    data: {
      state: "available",
      releasedAt: new Date(),
      reservedAt: null,
      expiresAt: null,
    },
  });
}

async function seedFreeIfNew(userId: string): Promise<void> {
  const everHad = await prisma.skinEntitlement.count({ where: { userId } });
  if (everHad === 0) {
    await prisma.skinEntitlement.create({
      data: { userId, state: "available", source: "free" },
    });
  }
}

export async function getAccessState(userId: string): Promise<SkinAccessState> {
  await releaseExpired(userId);
  const reserved = await prisma.skinEntitlement.findFirst({
    where: { userId, state: "reserved" },
    orderBy: { reservedAt: "desc" },
  });
  if (reserved) return { status: "reserved", grantId: reserved.id };

  let available = await prisma.skinEntitlement.count({
    where: { userId, state: "available" },
  });
  if (available === 0) {
    await seedFreeIfNew(userId);
    available = await prisma.skinEntitlement.count({
      where: { userId, state: "available" },
    });
  }
  if (available > 0) return { status: "ready", remaining: available };
  return { status: "none" };
}

/**
 * Reserve one scan for a handoff. Returns the grant id to embed in the token,
 * or null if the user has none left. Reuses an existing reservation (two-tab
 * safety) and claims an available row with a compare-and-set guard.
 */
export async function reserve(userId: string): Promise<string | null> {
  await releaseExpired(userId);

  const existing = await prisma.skinEntitlement.findFirst({
    where: { userId, state: "reserved" },
    orderBy: { reservedAt: "desc" },
  });
  if (existing) {
    await prisma.skinEntitlement.update({
      where: { id: existing.id },
      data: { expiresAt: new Date(Date.now() + RESERVATION_TTL_MS) },
    });
    return existing.id;
  }

  await seedFreeIfNew(userId);

  const candidate = await prisma.skinEntitlement.findFirst({
    where: { userId, state: "available" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const now = new Date();
  const claimed = await prisma.skinEntitlement.updateMany({
    where: { id: candidate.id, state: "available" }, // CAS guard against races
    data: {
      state: "reserved",
      reservedAt: now,
      expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
    },
  });
  if (claimed.count === 0) return reserve(userId); // lost a race — retry once
  return candidate.id;
}

/**
 * Consume a reservation on a successful analysis. Idempotent: a retried callback
 * for the SAME analysis returns true without double-spending.
 */
export async function consume(
  grantId: string,
  analysisId: string
): Promise<boolean> {
  const res = await prisma.skinEntitlement.updateMany({
    where: { id: grantId, state: "reserved" },
    data: { state: "consumed", consumedAt: new Date(), analysisId },
  });
  if (res.count > 0) return true;
  const row = await prisma.skinEntitlement.findUnique({
    where: { id: grantId },
  });
  return !!row && row.state === "consumed" && row.analysisId === analysisId;
}

/** Grant an extra scan (admin approval of a request). */
export async function grant(
  userId: string,
  source: "granted" | "free" = "granted"
): Promise<void> {
  await prisma.skinEntitlement.create({
    data: { userId, state: "available", source },
  });
}
