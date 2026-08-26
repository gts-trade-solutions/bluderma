import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Who is acting, in the doctor portal.
 *
 * THE INVARIANT, unchanged from the original portal and worth restating
 * because everything here depends on it: the doctor is resolved from the
 * SESSION USER ID, never from a doctorId in the request. A server action is a
 * public endpoint — anyone who knows its id can invoke it with any arguments
 * they like — so a doctorId supplied by the caller is an assertion, not a
 * fact. Every read and every write goes through this.
 *
 * Deliberately does NOT filter on approval status: a DRAFT or PENDING
 * practitioner must still be able to sign in and finish their application.
 * What they cannot do is appear publicly, and that is enforced separately by
 * PUBLIC_DOCTOR_WHERE on the read side.
 */

export interface DoctorOwner {
  userId: string;
  doctorId: string;
  /** Narrows what the portal offers — a pending doctor has no patients yet. */
  status: string;
  name: string;
  /** "BLU-DR-9T3N6XB". Quoted on referrals and aftercare sheets. */
  publicId: string;
  requiresApproval: boolean;
  travelBufferMin: number;
  /** Their portrait, for the rail and the portal header. */
  image: string;
}

export async function getOwnDoctor(): Promise<DoctorOwner | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
    return null;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      publicId: true,
      status: true,
      requiresApproval: true,
      travelBufferMin: true,
      image: true,
    },
  });
  if (!doctor) return null;

  return {
    userId: user.id,
    doctorId: doctor.id,
    status: doctor.status,
    name: doctor.name,
    publicId: doctor.publicId ?? "",
    image: doctor.image,
    requiresApproval: doctor.requiresApproval,
    travelBufferMin: doctor.travelBufferMin,
  };
}

/**
 * Confirms an appointment belongs to the signed-in doctor before it is
 * touched.
 *
 * Returns the same "not found" for an appointment that does not exist and one
 * that belongs to somebody else, so the portal cannot be used to discover
 * which appointment ids are real.
 */
export async function ownAppointment(doctorId: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId },
    select: {
      id: true,
      doctorId: true,
      clinicId: true,
      scheduledAt: true,
      durationMin: true,
      mode: true,
      status: true,
      approvalState: true,
      isPriority: true,
      rescheduleCount: true,
      feeAtBooking: true,
      visitFee: true,
      discountInr: true,
      patientUserId: true,
      patientName: true,
      patientEmail: true,
      patientPhone: true,
      notes: true,
      meetingUrl: true,
      doctor: { select: { name: true } },
      clinic: { select: { id: true, name: true, area: true, city: true } },
    },
  });
}
