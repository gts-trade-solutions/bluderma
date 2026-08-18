// No `import "server-only"` here on purpose: this is imported by the
// verification script under tsx, where that package does not resolve. The
// Prisma import already makes it unusable in a client component.
import { DoctorStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Guarantees a DOCTOR account has a practice record to onboard into.
 *
 * A practitioner login and a practice record are two rows, and they were being
 * created together in exactly one place — /doctor/join's own first step. Every
 * other route to a DOCTOR account produced a login with nothing attached:
 *
 *   - /register?as=doctor (the fix that made clinician sign-up possible at all)
 *   - an admin setting a user's role to DOCTOR in /admin/users
 *   - a signup where the account was created and the transaction then failed
 *
 * All three landed on "No practice record yet — send us a note", which is a
 * dead end for the one person the onboarding wizard exists to serve. A DOCTOR
 * with no practice IS someone who needs to onboard, so the answer is to make
 * the draft and let them get on with it, not to ask them to email us.
 *
 * Idempotent: returns the existing record when there is one, so it is safe to
 * call on every render of the wizard.
 */

/** Turns a name into a URL handle, e.g. "Dr. Aarti Menon" -> "dr-aarti-menon". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Adds -2, -3 … until the handle is free. */
async function uniqueSlug(
  base: string,
  tx: Prisma.TransactionClient | typeof prisma
): Promise<string> {
  const root = base || "practice";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await tx.doctor.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export interface EnsuredPractice {
  id: string;
  slug: string;
  /** True when this call created it, so callers can log or audit the fact. */
  created: boolean;
}

export async function ensurePractice(
  user: { id: string; name?: string | null; email?: string | null; phone?: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<EnsuredPractice> {
  const existing = await client.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, slug: true },
  });
  if (existing) return { ...existing, created: false };

  const name = user.name?.trim() || "New practitioner";
  const slug = await uniqueSlug(slugify(name), client);

  const doctor = await client.doctor.create({
    data: {
      slug,
      userId: user.id,
      name,
      phone: user.phone ?? null,
      email: user.email ?? null,
      // Empty rather than invented. A half-finished application must never
      // read as a real listing, and the wizard fills every one of these in.
      title: "",
      specialty: "",
      clinic: "",
      location: "",
      image: "",
      about: "",
      status: DoctorStatus.DRAFT,
      // Invisible to clients twice over, until an admin approves it.
      isActive: false,
    },
    select: { id: true, slug: true },
  });

  return { ...doctor, created: true };
}
