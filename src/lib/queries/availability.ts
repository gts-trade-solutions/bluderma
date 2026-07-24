import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Real slot availability, replacing the seeded PRNG that used to fake it.
 *
 * TIMEZONE CONTRACT — read this before touching booking code.
 * The clinic's wall-clock time is anchored to UTC: a 10:30 slot on 2026-08-03
 * is stored as exactly 2026-08-03T10:30:00.000Z. There is no timezone
 * conversion anywhere, which means the displayed time always round-trips
 * unchanged and there is no DST ambiguity. It also means this is correct only
 * while BluDerma runs on a single clinic timezone. Multi-region scheduling
 * needs a real tz column per doctor — that is a deliberate fast-follow, not an
 * oversight.
 */

export type SlotPeriod = "Morning" | "Afternoon" | "Evening";

export interface Slot {
  label: string;
  available: boolean;
  period: SlotPeriod;
}

export interface DayOption {
  daySeed: string;
  label: string;
  sub: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/** "2026-08-03" + "10:30" -> the UTC instant that slot is stored at. */
export function slotInstant(daySeed: string, time: string): Date {
  return new Date(`${daySeed}T${time}:00.000Z`);
}

export function periodFor(hour: number): SlotPeriod {
  if (hour < 12) return "Morning";
  return hour < 16 ? "Afternoon" : "Evening";
}

function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function labelToMinutes(label: string): number {
  const [h, m] = label.split(":").map(Number);
  return h * 60 + m;
}

/** The next `count` bookable days, starting today (UTC). */
export function buildDayOptions(base: Date, count = 5): DayOption[] {
  const out: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i)
    );
    const daySeed = d.toISOString().slice(0, 10);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : WEEKDAYS[d.getUTCDay()];
    out.push({
      daySeed,
      label,
      sub: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
    });
  }
  return out;
}

/**
 * Slots for one doctor on one day: generated from their weekly availability,
 * minus anything already booked, minus time off, minus times already past.
 */
export async function getSlotsForDoctor(
  doctorSlug: string,
  daySeed: string
): Promise<Slot[]> {
  const doctor = await prisma.doctor.findFirst({
    where: { slug: doctorSlug, isActive: true },
    select: { id: true },
  });
  if (!doctor) return [];

  const dayStart = new Date(`${daySeed}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) return [];
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayOfWeek = dayStart.getUTCDay();

  const [windows, booked, timeOff] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctorId: doctor.id, dayOfWeek, isActive: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
      select: { scheduledAt: true },
    }),
    prisma.doctorTimeOff.findMany({
      where: { doctorId: doctor.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const takenLabels = new Set(
    booked.map((b) => b.scheduledAt.toISOString().slice(11, 16))
  );
  const now = Date.now();

  const slots: Slot[] = [];
  for (const w of windows) {
    const start = labelToMinutes(w.startTime);
    const end = labelToMinutes(w.endTime);
    const step = w.slotMinutes > 0 ? w.slotMinutes : 30;

    for (let t = start; t <= end; t += step) {
      const label = minutesToLabel(t);
      const instant = slotInstant(daySeed, label);

      const isPast = instant.getTime() <= now;
      const isTaken = takenLabels.has(label);
      const isBlocked = timeOff.some(
        (o) => instant >= o.startsAt && instant < o.endsAt
      );

      slots.push({
        label,
        period: periodFor(Math.floor(t / 60)),
        available: !isPast && !isTaken && !isBlocked,
      });
    }
  }

  // A doctor could have overlapping windows; keep one entry per time.
  const seen = new Set<string>();
  return slots
    .filter((s) => (seen.has(s.label) ? false : (seen.add(s.label), true)))
    .sort((a, b) => labelToMinutes(a.label) - labelToMinutes(b.label));
}

/** Slots for several days at once — used to render the booking modal. */
export async function getSlotsForDays(
  doctorSlug: string,
  daySeeds: string[]
): Promise<Record<string, Slot[]>> {
  const entries = await Promise.all(
    daySeeds.map(
      async (seed) => [seed, await getSlotsForDoctor(doctorSlug, seed)] as const
    )
  );
  return Object.fromEntries(entries);
}
