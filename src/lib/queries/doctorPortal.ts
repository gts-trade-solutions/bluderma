import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The Doctor record linked to a signed-in practitioner's user account, or null
 * if their login isn't attached to a directory entry yet.
 *
 * Every doctor-portal read and write resolves the doctor THIS way — from the
 * session user id — never from a doctorId in the request. That's what stops one
 * doctor from reading or acting on another's appointments.
 */
export async function getDoctorForUser(userId: string) {
  return prisma.doctor.findUnique({
    where: { userId },
    include: {
      focus: { include: { concern: { select: { key: true, label: true } } } },
      languages: { orderBy: { sortOrder: "asc" } },
      services: { orderBy: { sortOrder: "asc" } },
      modes: true,
      availability: { orderBy: { dayOfWeek: "asc" } },
    },
  });
}

export async function getDoctorAppointments(
  doctorId: string,
  when: "upcoming" | "past"
) {
  const now = new Date();
  return prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: when === "upcoming" ? { gte: now } : { lt: now },
    },
    orderBy: { scheduledAt: when === "past" ? "desc" : "asc" },
    take: 200,
    select: {
      id: true,
      scheduledAt: true,
      mode: true,
      status: true,
      feeAtBooking: true,
      /// Null for guest bookings — there is then no profile to file a
      /// prescription into, and the portal says so instead of failing.
      patientUserId: true,
      patientName: true,
      patientPhone: true,
      patientEmail: true,
      notes: true,
    },
  });
}

export async function getDoctorStats(doctorId: string) {
  const now = new Date();
  const [upcoming, completed, cancelled] = await Promise.all([
    prisma.appointment.count({
      where: {
        doctorId,
        status: AppointmentStatus.CONFIRMED,
        scheduledAt: { gte: now },
      },
    }),
    prisma.appointment.count({
      where: { doctorId, status: AppointmentStatus.COMPLETED },
    }),
    prisma.appointment.count({
      where: { doctorId, status: AppointmentStatus.CANCELLED },
    }),
  ]);
  return { upcoming, completed, cancelled };
}
