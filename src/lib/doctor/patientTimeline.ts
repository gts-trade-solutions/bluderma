import {
  AppointmentStatus,
  ApprovalState,
  type ActorKind,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { reasonLabel } from "@/lib/booking/visitIntake";

/**
 * What a patient has done, as their doctor sees it.
 *
 * ── Derived, not logged ──────────────────────────────────────────────────
 * The obvious build is an activity table written to at every call site. This
 * does not do that, for three reasons:
 *
 *   1. A new log starts empty. Every cancellation this practice has ever had
 *      would be invisible on the day it shipped, which is precisely the
 *      history a doctor wants when somebody cancels a third time.
 *   2. It cannot drift. A log is a second copy of the truth, and the copy is
 *      wrong the first time somebody adds a code path and forgets to write to
 *      it. These events ARE the appointment rows.
 *   3. Nothing is recorded that was not already being recorded. There is no
 *      "viewed your profile at 11:04", because tracking that would be
 *      surveillance dressed as a feature, and no clinician asked for it.
 *
 * The cost is that only things the product already stores can appear. That is
 * the correct trade for a screen a doctor uses to decide whether to keep
 * offering someone appointments.
 *
 * ── Scoped to this doctor's own dealings ─────────────────────────────────
 * A doctor sees what happened between this patient and THEM. Not the person's
 * bookings with another practice, not their scans in general. Every query
 * below is filtered by doctorId, and the two that cannot be (a scan is not
 * tied to a doctor) are limited to scans attached to one of this doctor's own
 * appointments.
 */

export type TimelineKind =
  | "booked"
  | "cancelled"
  | "no-show"
  | "completed"
  | "rescheduled"
  | "scan"
  | "plan"
  | "aftercare"
  | "review";

export interface TimelineEvent {
  id: string;
  at: Date;
  kind: TimelineKind;
  /** One line, already written. Never assembled in the view. */
  summary: string;
  /** Extra colour where there is any: a reason, a fee, who did it. */
  detail?: string;
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const when = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "the clinic" reads better than "CLINIC" in a sentence. */
function actor(a: ActorKind | null): string {
  if (a === "PATIENT") return "the client";
  if (a === "DOCTOR") return "you";
  if (a === "ADMIN") return "the clinic";
  return "someone";
}

export interface PatientSummary {
  bookings: number;
  cancellations: number;
  noShows: number;
  completed: number;
  /** Cancellations as a share of bookings, or null below a usable sample. */
  cancelRate: number | null;
  /** One sentence, or null when there is nothing worth saying. */
  flag: string | null;
}

/**
 * The headline a doctor reads before the list.
 *
 * `cancelRate` is null under five bookings on purpose. One cancellation out of
 * two is 50%, and printing that next to somebody's name would invite a
 * judgement the data cannot support.
 */
export function summarise(events: TimelineEvent[]): PatientSummary {
  const count = (k: TimelineKind) => events.filter((e) => e.kind === k).length;

  const bookings = count("booked");
  const cancellations = count("cancelled");
  const noShows = count("no-show");
  const completed = count("completed");

  const MIN_SAMPLE = 5;
  const cancelRate = bookings >= MIN_SAMPLE ? cancellations / bookings : null;

  let flag: string | null = null;
  if (noShows >= 2) {
    flag = `${noShows} no-shows. Worth asking for confirmation before holding a slot.`;
  } else if (cancelRate !== null && cancelRate >= 0.4) {
    flag = `Cancels about ${Math.round(cancelRate * 100)}% of bookings, over ${bookings}.`;
  } else if (completed >= 5) {
    flag = `${completed} completed visits. A regular.`;
  }

  return { bookings, cancellations, noShows, completed, cancelRate, flag };
}

export interface Timeline {
  events: TimelineEvent[];
  /** True when older events exist beyond what was returned. */
  truncated: boolean;
  /** Bookings on record, whether or not they fit in `events`. */
  totalBookings: number;
}

/**
 * Assemble the timeline for one patient, as this doctor may see it.
 *
 * Returns newest first. Every event carries a real date from a real row; none
 * is inferred from another's absence.
 *
 * ── It says when it is showing a subset ──────────────────────────────────
 * A long-standing patient can have hundreds of appointments, and each produces
 * several events. Cutting the list silently would make a partial history look
 * like a complete one, which is the failure that matters on a screen used to
 * judge whether somebody cancels a lot. `truncated` exists so the view can say
 * so, and `totalBookings` is counted rather than inferred from the slice.
 */
export async function getPatientTimeline(
  doctorId: string,
  patientUserId: string,
  limit = 60
): Promise<Timeline> {
  const [totalBookings, appointments, plans, sheets, reviews] = await Promise.all([
    prisma.appointment.count({ where: { doctorId, patientUserId } }),
    prisma.appointment.findMany({
      where: { doctorId, patientUserId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        scheduledAt: true,
        status: true,
        approvalState: true,
        reason: true,
        cancelledAt: true,
        cancelledBy: true,
        cancelReason: true,
        cancellationFeeInr: true,
        rescheduleCount: true,
        rescheduledBy: true,
        updatedAt: true,
        skinScan: { select: { id: true, createdAt: true } },
      },
    }),
    prisma.treatmentPlan.findMany({
      where: { doctorId, patientUserId, sharedAt: { not: null } },
      select: { id: true, sharedAt: true, items: { where: { state: "ACCEPTED" }, select: { id: true } } },
    }),
    prisma.aftercareSheet.findMany({
      where: { doctorId, patientUserId },
      select: { id: true, issuedAt: true, acknowledgedAt: true, procedure: true },
    }),
    prisma.review.findMany({
      where: { doctorId, userId: patientUserId },
      select: { id: true, createdAt: true, rating: true },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const a of appointments) {
    const what = a.reason ? reasonLabel(a.reason) : "a visit";

    events.push({
      id: `${a.id}-booked`,
      at: a.createdAt,
      kind: "booked",
      summary: `Booked ${what} for ${when(a.scheduledAt)}`,
      detail:
        a.approvalState === ApprovalState.AWAITING_DOCTOR
          ? "Waiting on your confirmation"
          : undefined,
    });

    // Rescheduling has no timestamp of its own, only a counter, so the event
    // is dated from the row's last change. Said plainly rather than dressed up
    // as an exact moment it is not.
    if (a.rescheduleCount > 0) {
      events.push({
        id: `${a.id}-moved`,
        at: a.updatedAt,
        kind: "rescheduled",
        summary: `Moved ${a.rescheduleCount === 1 ? "once" : `${a.rescheduleCount} times`}, by ${actor(a.rescheduledBy)}`,
        detail: "Dated from the last change to this booking",
      });
    }

    if (a.status === AppointmentStatus.CANCELLED && a.cancelledAt) {
      events.push({
        id: `${a.id}-cancelled`,
        at: a.cancelledAt,
        kind: "cancelled",
        summary: `Cancelled by ${actor(a.cancelledBy)}`,
        detail:
          [
            a.cancelReason || null,
            a.cancellationFeeInr > 0 ? `${money(a.cancellationFeeInr)} fee charged` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      });
    }

    if (a.status === AppointmentStatus.NO_SHOW) {
      events.push({
        id: `${a.id}-noshow`,
        at: a.scheduledAt,
        kind: "no-show",
        summary: "Did not attend",
      });
    }

    if (a.status === AppointmentStatus.COMPLETED) {
      events.push({
        id: `${a.id}-done`,
        at: a.scheduledAt,
        kind: "completed",
        summary: `Seen for ${what}`,
      });
    }

    // A scan only appears when it was attached to one of THIS doctor's
    // bookings. Someone's analyses in general are not their doctor's business.
    if (a.skinScan) {
      events.push({
        id: `${a.skinScan.id}-scan`,
        at: a.skinScan.createdAt,
        kind: "scan",
        summary: "Ran a skin analysis and attached it to this booking",
      });
    }
  }

  for (const p of plans) {
    if (!p.sharedAt) continue;
    events.push({
      id: `${p.id}-plan`,
      at: p.sharedAt,
      kind: "plan",
      summary: `You shared a treatment plan with ${p.items.length} treatment${p.items.length === 1 ? "" : "s"}`,
    });
  }

  for (const s of sheets) {
    events.push({
      id: `${s.id}-issued`,
      at: s.issuedAt,
      kind: "aftercare",
      summary: `You issued aftercare for ${s.procedure}`,
    });
    if (s.acknowledgedAt) {
      events.push({
        id: `${s.id}-read`,
        at: s.acknowledgedAt,
        kind: "aftercare",
        summary: `Confirmed they had read the ${s.procedure} aftercare`,
      });
    }
  }

  for (const r of reviews) {
    events.push({
      id: `${r.id}-review`,
      at: r.createdAt,
      kind: "review",
      summary: `Left a ${r.rating}-star review`,
    });
  }

  const ordered = events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    events: ordered.slice(0, limit),
    truncated: ordered.length > limit || totalBookings > appointments.length,
    totalBookings,
  };
}
