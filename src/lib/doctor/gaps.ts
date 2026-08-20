import { prisma } from "@/lib/prisma";

/**
 * What is missing from a practitioner's listing, in one place.
 *
 * This used to exist twice, disagreeing: `applicationGaps()` in
 * lib/actions/doctorOnboarding.ts listed the eight things that block a
 * submission, and the profile page inlined six different ones about how the
 * listing reads. A doctor could therefore be told "nothing is missing" on one
 * screen and "your listing is missing 3 things" on another.
 *
 * They are the same question asked with different stakes, so they are one list
 * with a `blocking` flag: blocking gaps stop the application being sent,
 * advisory gaps are things a client notices the absence of.
 *
 * Deliberately a plain module and NOT "use server". The old version was an
 * exported server action taking a doctorId — a public endpoint that would tell
 * any caller which fields any practitioner was missing. Callers now pass a
 * doctorId they already own, resolved from the session.
 */

export interface ApplicationGap {
  key: string;
  /** Shown to the doctor, in their own terms. */
  label: string;
  /** Which JOIN_STEPS index fixes it, so the UI can link straight there. */
  step: number;
  /** True when this stops the application being submitted. */
  blocking: boolean;
}

/** The step a gap is fixed on — indexes into JOIN_STEPS (src/data/doctorJoin.ts). */
const STEP = {
  about: 1,
  credentials: 2,
  clinics: 3,
  hours: 4,
  consult: 5,
} as const;

export async function getApplicationGaps(
  doctorId: string
): Promise<ApplicationGap[]> {
  const d = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      title: true,
      specialty: true,
      about: true,
      image: true,
      fee: true,
      regCouncil: true,
      regNumber: true,
      instagram: true,
      facebook: true,
      linkedin: true,
      youtube: true,
      website: true,
      _count: {
        select: {
          clinics: true,
          modes: true,
          availability: true,
          languages: true,
          services: true,
        },
      },
    },
  });

  if (!d) {
    return [
      {
        key: "missing",
        label: "Your application could not be found.",
        step: STEP.about,
        blocking: true,
      },
    ];
  }

  const gaps: ApplicationGap[] = [];
  const add = (
    key: string,
    label: string,
    step: number,
    blocking: boolean
  ) => gaps.push({ key, label, step, blocking });

  // ── Blocking: an application without these cannot be reviewed ──────────
  if (!d.title.trim()) add("title", "Your qualifications", STEP.about, true);
  if (!d.specialty.trim()) add("specialty", "Your specialty", STEP.about, true);
  if (d.about.trim().length < 40) {
    add("about", "A description clients can read", STEP.about, true);
  }
  if (!d.image.trim()) add("image", "A photograph of you", STEP.about, true);
  if (!d.regCouncil?.trim() || !d.regNumber?.trim()) {
    add("registration", "Your medical registration details", STEP.credentials, true);
  }
  if (d._count.clinics === 0) add("clinics", "At least one clinic", STEP.clinics, true);
  if (d._count.availability === 0) {
    add("hours", "Your working hours", STEP.hours, true);
  }
  if (d._count.modes === 0) add("modes", "How you see clients", STEP.consult, true);

  // ── Advisory: allowed to go live without, but the listing reads thin ───
  // A longer bar than the blocking one on purpose: 40 characters is enough to
  // review, 80 is enough to read.
  if (d.about.trim().length >= 40 && d.about.trim().length < 80) {
    add("about-short", "A fuller description", STEP.about, false);
  }
  if (d._count.languages === 0) {
    add("languages", "The languages you speak", STEP.consult, false);
  }
  if (d._count.services === 0) {
    add("services", "The treatments you offer", STEP.consult, false);
  }
  const hasLink = Boolean(
    d.instagram || d.facebook || d.linkedin || d.youtube || d.website
  );
  if (!hasLink) {
    add("links", "A link clients can check you on", STEP.about, false);
  }
  // Zero is a legitimate answer here — it means "on enquiry" — so this is only
  // ever a prompt, never a blocker. See docs Appendix M.
  if (!d.fee) add("fee", "A consultation fee", STEP.clinics, false);

  return gaps;
}

export function blockingGaps(gaps: ApplicationGap[]): ApplicationGap[] {
  return gaps.filter((g) => g.blocking);
}

export function advisoryGaps(gaps: ApplicationGap[]): ApplicationGap[] {
  return gaps.filter((g) => !g.blocking);
}

/**
 * Where to drop a returning doctor.
 *
 * The earliest step that still has something blocking on it, so somebody who
 * left off halfway does not land on step 1 and have to walk forward through
 * screens they already finished. Everything done → the review step.
 */
export function firstIncompleteStep(gaps: ApplicationGap[]): number {
  const blocking = blockingGaps(gaps);
  if (blocking.length === 0) return 6; // review
  return Math.min(...blocking.map((g) => g.step));
}
