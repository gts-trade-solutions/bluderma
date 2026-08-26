import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { PUBLIC_DOCTOR_WHERE } from "./doctorAccess";

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

/**
 * BluDerma runs on a single clinic timezone: India (UTC+5:30, no DST). Slot
 * instants are wall-clock labelled as UTC (see the contract above), so "now"
 * has to be shifted into that same frame before any past-slot comparison —
 * otherwise a 13:00 slot (stored 13:00Z) still looks 5½ hours in the future at
 * 15:00 IST, and already-passed times keep showing as bookable.
 */
export const CLINIC_UTC_OFFSET_MINUTES = 330;

/** The current instant expressed in the clinic's wall clock (labelled as UTC). */
export function clinicNow(): number {
  return Date.now() + CLINIC_UTC_OFFSET_MINUTES * 60_000;
}

export type SlotPeriod = "Morning" | "Afternoon" | "Evening";

/**
 * Why a slot cannot be taken. Carried so the UI can say which, instead of
 * greying out half a grid with no explanation — "the doctor is at another
 * clinic" and "someone booked it" deserve different words.
 */
export type SlotBlock = "past" | "taken" | "timeoff" | "travel" | "members";

export interface Slot {
  label: string;
  available: boolean;
  period: SlotPeriod;
  /** The location this slot is at. Null only for legacy hours with no clinic. */
  clinicId: string | null;
  clinicName: string | null;
  /** Set when `available` is false. */
  blockedBy?: SlotBlock;
}

export interface SlotOptions {
  /** Restrict to one location. Omitted, every clinic the doctor works at. */
  clinicId?: string;
  /** Gold Collar members see slots held back from everyone else. */
  isMember?: boolean;
}

export interface DayOption {
  daySeed: string;
  label: string;
  sub: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/** "2026-08-03" + "10:30" -> the UTC instant that slot is stored at. */
/** The clinic's wall clock as a Date, for reading day/hour off with getUTC*. */
export function clinicWallClock(): Date {
  return new Date(clinicNow());
}

/**
 * Today, in clinic wall-clock terms.
 *
 * Lived as a private copy inside the portal's Today page, next to a second
 * hardcoded 330. It belongs here with the offset it depends on — two copies of
 * a timezone rule is one copy too many.
 */
export function clinicTodayBounds(): { from: Date; to: Date; seed: string } {
  const now = clinicWallClock();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return {
    from,
    to: new Date(from.getTime() + 86_400_000),
    seed: from.toISOString().slice(0, 10),
  };
}

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
 * Slots for one doctor on one day.
 *
 * Generated from their weekly hours, minus what is booked, minus time off,
 * minus what has already passed — and, now that a practitioner may hold hours
 * at several clinics, minus what they physically cannot reach.
 *
 * THE MULTI-CLINIC RULE. A booking blocks the doctor, not the location. The
 * unique index on Appointment.slotLock is keyed "<doctorId>@<ISO>", so 10:30
 * at one clinic already makes 10:30 at another unbookable — one body cannot be
 * in two places. What the index cannot express is the drive between them, so
 * Doctor.travelBufferMin widens each booking at a *different* clinic into a
 * blocked band either side. A buffer of 0 reproduces the old behaviour exactly.
 */
export async function getSlotsForDoctor(
  doctorSlug: string,
  daySeed: string,
  opts: SlotOptions = {}
): Promise<Slot[]> {
  const doctor = await prisma.doctor.findFirst({
    where: { slug: doctorSlug, ...PUBLIC_DOCTOR_WHERE },
    select: { id: true, travelBufferMin: true, priorityHoldPerDay: true },
  });
  if (!doctor) return [];

  const dayStart = new Date(`${daySeed}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) return [];
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayOfWeek = dayStart.getUTCDay();

  const [windows, booked, timeOff] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
        dayOfWeek,
        isActive: true,
        ...(opts.clinicId ? { clinicId: opts.clinicId } : {}),
        // A window at a clinic that has been switched off is not bookable.
        OR: [{ clinicId: null }, { clinic: { isActive: true } }],
      },
      orderBy: { startTime: "asc" },
      include: { clinic: { select: { id: true, name: true } } },
    }),
    // Deliberately NOT filtered by clinic: a booking anywhere blocks the
    // doctor everywhere. Filtering here is the bug this whole function exists
    // to avoid.
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
      select: { scheduledAt: true, durationMin: true, clinicId: true },
    }),
    prisma.doctorTimeOff.findMany({
      where: { doctorId: doctor.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const buffer = Math.max(0, doctor.travelBufferMin);
  // Minute-of-day for every booking, so the comparisons below stay integer
  // arithmetic in the same frame as the window labels.
  const bookings = booked.map((b) => ({
    startMin: b.scheduledAt.getUTCHours() * 60 + b.scheduledAt.getUTCMinutes(),
    durationMin: b.durationMin || 30,
    clinicId: b.clinicId,
  }));

  // Compare against the clinic wall clock, not raw UTC (see clinicNow).
  const now = clinicNow();
  const HOLD_RELEASE_MS = 24 * 60 * 60 * 1000;

  const slots: Slot[] = [];
  for (const w of windows) {
    const start = labelToMinutes(w.startTime);
    const end = labelToMinutes(w.endTime);
    const step = w.slotMinutes > 0 ? w.slotMinutes : 30;
    const clinicId = w.clinic?.id ?? null;
    const clinicName = w.clinic?.name ?? null;

    // NOTE: `t <= end` generates a slot AT endTime. That is long-standing
    // behaviour every seeded doctor depends on; changing it here would quietly
    // delete everyone's last appointment of the day.
    for (let t = start; t <= end; t += step) {
      const label = minutesToLabel(t);
      const instant = slotInstant(daySeed, label);

      let blockedBy: SlotBlock | undefined;

      if (instant.getTime() <= now) {
        blockedBy = "past";
      } else if (timeOff.some((o) => instant >= o.startsAt && instant < o.endsAt)) {
        blockedBy = "timeoff";
      } else {
        for (const b of bookings) {
          // Overlap in the doctor's day at all -> taken outright.
          const overlaps = t < b.startMin + b.durationMin && b.startMin < t + step;
          if (overlaps) {
            blockedBy = "taken";
            break;
          }
          // Otherwise, only a booking at a DIFFERENT clinic costs travel time.
          // Same-clinic back-to-back appointments are the normal working day.
          if (buffer > 0 && b.clinicId && clinicId && b.clinicId !== clinicId) {
            const tooClose =
              t < b.startMin + b.durationMin + buffer && b.startMin < t + step + buffer;
            if (tooClose) {
              blockedBy = "travel";
              break;
            }
          }
        }
      }

      slots.push({
        label,
        period: periodFor(Math.floor(t / 60)),
        available: !blockedBy,
        clinicId,
        clinicName,
        blockedBy,
      });
    }
  }

  // A doctor can have overlapping windows; keep one entry per time PER
  // CLINIC. Deduping on the label alone would silently drop a second
  // location's 10:00.
  const seen = new Set<string>();
  const unique = slots
    .filter((s) => {
      const key = `${s.clinicId ?? "-"}@${s.label}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .sort((a, b) => labelToMinutes(a.label) - labelToMinutes(b.label));

  applyPriorityHold(unique, daySeed, doctor.priorityHoldPerDay, opts.isMember, now, HOLD_RELEASE_MS);
  return unique;
}

/**
 * Hold back the last few slots of a day for Gold Collar members.
 *
 * The end of the day is chosen because evening appointments are what people
 * actually compete for — holding back a 10am Tuesday would be a benefit in
 * name only. The hold lapses 24 hours out so an unsold slot is never wasted,
 * which also means the doctor loses nothing by switching it on.
 *
 * Mutates in place; the caller already owns the array.
 */
function applyPriorityHold(
  slots: Slot[],
  daySeed: string,
  holdPerDay: number,
  isMember: boolean | undefined,
  now: number,
  releaseMs: number
): void {
  if (holdPerDay <= 0 || isMember) return;

  const openable = slots.filter((s) => s.available);
  if (openable.length === 0) return;

  for (const slot of openable.slice(-holdPerDay)) {
    const instant = slotInstant(daySeed, slot.label).getTime();
    // Inside the release window it belongs to whoever wants it.
    if (instant - now <= releaseMs) continue;
    slot.available = false;
    slot.blockedBy = "members";
  }
}

/** Slots for several days at once — used to render the booking page. */
export async function getSlotsForDays(
  doctorSlug: string,
  daySeeds: string[],
  opts: SlotOptions = {}
): Promise<Record<string, Slot[]>> {
  const entries = await Promise.all(
    daySeeds.map(
      async (seed) => [seed, await getSlotsForDoctor(doctorSlug, seed, opts)] as const
    )
  );
  return Object.fromEntries(entries);
}
