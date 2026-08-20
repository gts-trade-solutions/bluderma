import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * A client cannot be in two places at once either.
 *
 * The platform is proud of enforcing this for doctors: a booking at one clinic
 * blocks that time at every other, and the travel buffer blocks the drive
 * between them. None of that applied to the person being seen. `slotLock` is
 * `doctorId@instant`, so it stops two clients taking one doctor's slot and does
 * nothing at all about one client taking three doctors' slots at 10:30.
 *
 * The consequence was not theoretical: a client could hold the same morning
 * with three practitioners, each of whom saw a confirmed booking, and at most
 * one of them was going to happen.
 *
 * ── Why this is read in JS rather than in SQL ────────────────────────────
 * The overlap test is `existing.start < new.end && existing.end > new.start`,
 * and `existing.end` is `scheduledAt + durationMin` — a value the row does not
 * store. Expressing that in a Prisma filter means raw SQL over a computed
 * column. A client has a handful of appointments near any given hour, so the
 * window below is fetched and compared in memory instead. It is a small read
 * on an indexed column, and it stays legible.
 */

/** The widest appointment we would ever schedule. Bounds the window we fetch. */
const MAX_DURATION_MIN = 240;
const MINUTE = 60_000;

export interface ClientClash {
  id: string;
  doctorName: string;
  scheduledAt: Date;
}

/**
 * Any live appointment of this client's that overlaps the proposed one.
 *
 * @param ignoreAppointmentId the booking being moved, which must not clash
 *   with itself during a reschedule.
 */
export async function findClientClash(
  patientUserId: string,
  scheduledAt: Date,
  durationMin: number,
  ignoreAppointmentId?: string
): Promise<ClientClash | null> {
  const start = scheduledAt.getTime();
  const end = start + durationMin * MINUTE;

  const nearby = await prisma.appointment.findMany({
    where: {
      patientUserId,
      // Cancelled and no-show rows released their claim on the time.
      status: {
        in: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.COMPLETED,
        ],
      },
      scheduledAt: {
        gte: new Date(start - MAX_DURATION_MIN * MINUTE),
        lte: new Date(end + MAX_DURATION_MIN * MINUTE),
      },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    },
    select: {
      id: true,
      scheduledAt: true,
      durationMin: true,
      doctor: { select: { name: true } },
    },
  });

  for (const a of nearby) {
    const aStart = a.scheduledAt.getTime();
    const aEnd = aStart + a.durationMin * MINUTE;
    // Touching endpoints do not overlap: a 10:00–10:30 and a 10:30–11:00 are
    // back to back, which is tight but legitimate.
    if (aStart < end && aEnd > start) {
      return { id: a.id, doctorName: a.doctor.name, scheduledAt: a.scheduledAt };
    }
  }
  return null;
}

/** The message the client sees. Names the clash so they can go and move it. */
export function clashMessage(clash: ClientClash): string {
  const at = clash.scheduledAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  const on = clash.scheduledAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `You already have an appointment with ${clash.doctorName} at ${at} on ${on}. Move or cancel that one first.`;
}
