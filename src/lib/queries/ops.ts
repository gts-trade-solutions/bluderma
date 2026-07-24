import { AppointmentStatus, EnquiryStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Read models for the admin ops screens (leads and appointments). Not wrapped
 * in React `cache()` — these pages are force-dynamic and each renders once.
 */

export interface EnquiryFilters {
  status?: EnquiryStatus;
  audience?: "DOCTOR" | "PATIENT";
  search?: string;
}

export async function getEnquiries(filters: EnquiryFilters = {}) {
  const where: Prisma.EnquiryWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.audience) where.audience = filters.audience;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { email: { contains: filters.search } },
      { organisation: { contains: filters.search } },
    ];
  }

  return prisma.enquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      treatment: { select: { name: true, slug: true } },
      assignedTo: { select: { name: true, email: true } },
      _count: { select: { notes: true } },
    },
  });
}

export async function getEnquiry(id: string) {
  return prisma.enquiry.findUnique({
    where: { id },
    include: {
      treatment: { select: { name: true, slug: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
}

export async function getEnquiryCounts() {
  const rows = await prisma.enquiry.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}

/** Staff who can own a lead. */
export async function getLeadOwners() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "DOCTOR"] }, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export interface AppointmentFilters {
  status?: AppointmentStatus;
  doctorId?: string;
  when?: "upcoming" | "past";
}

export async function getAdminAppointments(filters: AppointmentFilters = {}) {
  const where: Prisma.AppointmentWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.when === "upcoming") where.scheduledAt = { gte: new Date() };
  if (filters.when === "past") where.scheduledAt = { lt: new Date() };

  return prisma.appointment.findMany({
    where,
    orderBy: { scheduledAt: filters.when === "past" ? "desc" : "asc" },
    take: 200,
    include: {
      doctor: { select: { name: true, slug: true, clinic: true, location: true } },
      patient: { select: { email: true } },
    },
  });
}

export async function getAppointmentCounts() {
  const rows = await prisma.appointment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}
