import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalise } from "@/lib/publicId";

/**
 * Everybody this practice has seen, as a list they can be found in.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * There was no way to reach a patient except through a booking. A doctor with
 * a name and a phone in front of them — the person standing at the desk, the
 * person who just rang — had to remember which day they last came in and open
 * the calendar at it. Every patient screen in this portal (the chart, the
 * photographs, the care sheets, the prescriptions) was already built and
 * effectively unlisted.
 *
 * ── Assembled from appointments, not from a Patient table ────────────────
 * There isn't one. A patient of this practice IS somebody with an appointment
 * here, which is also the boundary: a doctor sees the people they have seen,
 * and nobody else's clients.
 *
 * ── Guests are people too ────────────────────────────────────────────────
 * A booking taken over the phone has no account (`patientUserId` is null), and
 * leaving those out would hide exactly the walk-in a receptionist is most
 * likely to be searching for. They are grouped by name and phone — the only
 * identity they have — and marked as having no account, because there is no
 * record page to send anybody to.
 *
 * ── Why grouped queries rather than reading every row ────────────────────
 * A four-year practice has tens of thousands of appointments and a few
 * thousand patients. `groupBy` does the counting in the database; pulling the
 * rows to count them in JavaScript is the version that stops working in year
 * two.
 */

export interface PatientSummary {
  /** Null for a booking with no account: there is no record page for them. */
  userId: string | null;
  name: string;
  publicId: string | null;
  phone: string | null;
  visits: number;
  /** The most recent appointment at all, past or future. */
  lastSeen: Date | null;
  /** The next one still ahead, cancellations excluded. */
  nextVisit: Date | null;
}

export interface PatientPage {
  rows: PatientSummary[];
  /** Everyone matching, before the page was cut. */
  total: number;
  /** How many this practice has in total, for the empty-search case. */
  allTime: number;
}

export const PATIENTS_PER_PAGE = 25;

/**
 * Find people this doctor has seen.
 *
 * `q` matches a name, a phone number or a BluDerma id — the three things
 * somebody has to hand. The id is normalised first (see publicId.ts), so a
 * receptionist reading "blu p 4k7m2q" off a printed sheet finds the row.
 */
export async function getDoctorPatients(
  doctorId: string,
  { q = "", page = 0 }: { q?: string; page?: number } = {}
): Promise<PatientPage> {
  const term = q.trim();
  const now = new Date();

  /* A search for an id has to become a search for a user, because the id
     lives on User and the appointments do not carry it. */
  let idMatchUserIds: string[] = [];
  if (term) {
    const byId = await prisma.user.findMany({
      where: { publicId: normalise(term) },
      select: { id: true },
    });
    idMatchUserIds = byId.map((u) => u.id);
  }

  const match = term
    ? {
        OR: [
          { patientName: { contains: term } },
          { patientPhone: { contains: term } },
          ...(idMatchUserIds.length
            ? [{ patientUserId: { in: idMatchUserIds } }]
            : []),
        ],
      }
    : {};

  const base = { doctorId, ...match };

  const [accounts, guests, futureAccounts, futureGuests, allTimeGroups] =
    await Promise.all([
      prisma.appointment.groupBy({
        by: ["patientUserId"],
        where: { ...base, patientUserId: { not: null } },
        _count: { _all: true },
        _max: { scheduledAt: true },
      }),
      prisma.appointment.groupBy({
        by: ["patientName", "patientPhone"],
        where: { ...base, patientUserId: null },
        _count: { _all: true },
        _max: { scheduledAt: true },
      }),
      prisma.appointment.groupBy({
        by: ["patientUserId"],
        where: {
          ...base,
          patientUserId: { not: null },
          scheduledAt: { gte: now },
          status: { not: AppointmentStatus.CANCELLED },
        },
        _min: { scheduledAt: true },
      }),
      prisma.appointment.groupBy({
        by: ["patientName", "patientPhone"],
        where: {
          ...base,
          patientUserId: null,
          scheduledAt: { gte: now },
          status: { not: AppointmentStatus.CANCELLED },
        },
        _min: { scheduledAt: true },
      }),
      // Unfiltered, so an empty search result can say how many there are to
      // search through rather than implying the practice has no patients.
      prisma.appointment.groupBy({
        by: ["patientUserId", "patientName"],
        where: { doctorId },
        _count: { _all: true },
      }),
    ]);

  const users = accounts.length
    ? await prisma.user.findMany({
        where: {
          id: { in: accounts.map((a) => a.patientUserId!).filter(Boolean) },
        },
        select: { id: true, name: true, publicId: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  // The name on the booking is the fallback: a user row can have no name, and
  // the booking always carries one because the form demands it.
  const latestNameFor = new Map<string, string>();
  for (const g of allTimeGroups) {
    if (g.patientUserId) latestNameFor.set(g.patientUserId, g.patientName);
  }

  const nextByUser = new Map(
    futureAccounts.map((f) => [f.patientUserId!, f._min.scheduledAt])
  );
  const nextByGuest = new Map(
    futureGuests.map((f) => [
      `${f.patientName}|${f.patientPhone ?? ""}`,
      f._min.scheduledAt,
    ])
  );

  const rows: PatientSummary[] = [
    ...accounts.map((a) => {
      const id = a.patientUserId!;
      const u = userById.get(id);
      return {
        userId: id,
        name: u?.name ?? latestNameFor.get(id) ?? "Client",
        publicId: u?.publicId ?? null,
        phone: null,
        visits: a._count._all,
        lastSeen: a._max.scheduledAt,
        nextVisit: nextByUser.get(id) ?? null,
      };
    }),
    ...guests.map((g) => ({
      userId: null,
      name: g.patientName,
      publicId: null,
      phone: g.patientPhone,
      visits: g._count._all,
      lastSeen: g._max.scheduledAt,
      nextVisit: nextByGuest.get(`${g.patientName}|${g.patientPhone ?? ""}`) ?? null,
    })),
  ];

  /* Somebody with a booking tomorrow comes before somebody last seen
     yesterday: the list is read to find a person you are about to deal with,
     not to browse a database in date order. */
  rows.sort((x, y) => {
    if (x.nextVisit && y.nextVisit) return x.nextVisit.getTime() - y.nextVisit.getTime();
    if (x.nextVisit) return -1;
    if (y.nextVisit) return 1;
    return (y.lastSeen?.getTime() ?? 0) - (x.lastSeen?.getTime() ?? 0);
  });

  const from = page * PATIENTS_PER_PAGE;
  return {
    rows: rows.slice(from, from + PATIENTS_PER_PAGE),
    total: rows.length,
    allTime: allTimeGroups.length,
  };
}

/** Phone numbers are not on the grouped account rows; fetch them per page. */
export async function attachPhones(
  doctorId: string,
  rows: PatientSummary[]
): Promise<PatientSummary[]> {
  const ids = rows.map((r) => r.userId).filter((x): x is string => Boolean(x));
  if (!ids.length) return rows;

  /* The most recent booking's phone, per patient. Taken from the appointment
     rather than the profile because that is the number they last gave, and a
     stale profile number is the one that does not answer. */
  const recent = await prisma.appointment.findMany({
    where: { doctorId, patientUserId: { in: ids }, patientPhone: { not: null } },
    orderBy: { scheduledAt: "desc" },
    select: { patientUserId: true, patientPhone: true },
  });
  const phoneFor = new Map<string, string>();
  for (const r of recent) {
    if (r.patientUserId && !phoneFor.has(r.patientUserId) && r.patientPhone) {
      phoneFor.set(r.patientUserId, r.patientPhone);
    }
  }
  return rows.map((r) =>
    r.userId ? { ...r, phone: r.phone ?? phoneFor.get(r.userId) ?? null } : r
  );
}
