"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { audit } from "@/lib/admin/audit";
import { AdminResult, runAction } from "@/lib/admin/form";
import { fieldErrors } from "@/lib/validation";
import { enquiryNotifyAddress, sendEmail } from "@/lib/email";
import { normaliseSocials } from "@/lib/social";

/**
 * Resolves the Doctor record owned by the signed-in user. Returns null when
 * the caller isn't a doctor, or has no linked directory record. Callers must
 * treat null as "not permitted".
 */
async function requireOwnDoctor() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
    return null;
  }
  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  return doctor ? { userId: user.id, doctorId: doctor.id } : null;
}

/**
 * A list field that may arrive as repeated inputs or as one newline-joined
 * string, deduped case-insensitively.
 *
 * The pickers submit the first shape and the older textareas submit the
 * second, and both are still in use. Written once here rather than inlined
 * four times, which is how `languages` ended up accepting only the textarea
 * shape and quietly dropping everything a picker sent.
 */
const listField = (cap: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .default("")
    .transform((v) => {
      const raw = Array.isArray(v) ? v : v.split(/[\n,]/);
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of raw) {
        const t = item.trim();
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        out.push(t);
        if (out.length >= cap) break;
      }
      return out;
    });

const profileSchema = z.object({
  // Optional here, not in the form: an APPROVED doctor's form does not render
  // the field at all, and a missing value must mean "leave it alone" rather
  // than "clear it".
  name: z.string().trim().min(2, "Enter your name.").max(120).optional(),
  title: z.string().trim().min(1).max(160),
  specialty: z.string().trim().min(1).max(160),
  clinic: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  about: z.string().trim().min(1).max(2000),
  image: z.string().trim().min(1).max(2000),
  // Was string-only, so a picker's repeated inputs arrived as an array and
  // were silently dropped — a doctor editing their profile lost every
  // language they had chosen during onboarding.
  languages: listField(12),
  specialtyAreas: listField(8),
  otherConcerns: listField(12),
  // Either shape: the chip picker submits repeated inputs (collapsed to an
  // array by formToObject), the old textarea submits one newline-joined
  // string. Deduped case-insensitively so "Botox" and "botox" are one entry.
  services: z
    .union([z.string(), z.array(z.string())])
    .default("")
    .transform((v) => {
      const raw = Array.isArray(v) ? v : v.split("\n");
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of raw) {
        const t = item.trim();
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        out.push(t);
      }
      return out;
    }),
  // Accepted loosely and normalised on save — a doctor typing "@drmenon" is
  // giving a perfectly valid answer, and rejecting it teaches them nothing.
  instagram: z.string().trim().max(300).optional().default(""),
  facebook: z.string().trim().max(300).optional().default(""),
  linkedin: z.string().trim().max(300).optional().default(""),
  youtube: z.string().trim().max(300).optional().default(""),
  website: z.string().trim().max(300).optional().default(""),
});

/**
 * A doctor edits their own presentation fields, including their name. Fee,
 * verification, ratings, status and the registration details stay
 * admin-controlled — those are what actually carry standing, and a
 * practitioner must not be able to set them.
 */
export async function updateOwnProfile(
  formData: FormData
): Promise<AdminResult> {
  return runAction("updateOwnProfile", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const raw = Object.fromEntries(formData.entries());
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the form.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    // A doctor may correct their own name.
    //
    // It used to be admin-only, on the reasoning that a practitioner should not
    // be able to inflate their own standing. But the name is not what carries
    // standing here — `verified`, `rating`, `reviews`, `fee`, `status` and the
    // registration fields are, and all of those remain admin-only. Meanwhile
    // the same doctor could already rewrite their photograph, headline,
    // specialty and biography, so locking the one remaining field prevented no
    // impersonation while guaranteeing that anyone whose account was opened
    // under a company name or with a typo could never fix it. The rename is
    // recorded below with both values so it stays reviewable.
    const current = await prisma.doctor.findUniqueOrThrow({
      where: { id: owner.doctorId },
      select: { name: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id: owner.doctorId },
        data: {
          ...(d.name ? { name: d.name } : {}),
          title: d.title,
          specialty: d.specialty,
          clinic: d.clinic,
          location: d.location,
          about: d.about,
          image: d.image,
          ...normaliseSocials({
            instagram: d.instagram,
            facebook: d.facebook,
            linkedin: d.linkedin,
            youtube: d.youtube,
            website: d.website,
          }),
        },
      });
      await tx.doctorLanguage.deleteMany({ where: { doctorId: owner.doctorId } });
      await tx.doctorService.deleteMany({ where: { doctorId: owner.doctorId } });
      await tx.doctorSpecialtyArea.deleteMany({ where: { doctorId: owner.doctorId } });
      await tx.doctorConcernOther.deleteMany({ where: { doctorId: owner.doctorId } });
      if (d.languages.length) {
        await tx.doctorLanguage.createMany({
          data: d.languages.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
      if (d.services.length) {
        await tx.doctorService.createMany({
          data: d.services.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
      if (d.specialtyAreas.length) {
        await tx.doctorSpecialtyArea.createMany({
          data: d.specialtyAreas.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
      if (d.otherConcerns.length) {
        await tx.doctorConcernOther.createMany({
          data: d.otherConcerns.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Doctor",
      entityId: owner.doctorId,
      after: {
        self_edit: true,
        ...(d.name && d.name !== current.name
          ? { renamed_from: current.name, renamed_to: d.name }
          : {}),
      },
    });

    revalidatePath("/doctor/portal/profile");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}

const availabilitySchema = z.object({
  workDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .default([]),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.coerce.number().int().min(5).max(240),
});

export async function updateOwnAvailability(
  formData: FormData
): Promise<AdminResult> {
  return runAction("updateOwnAvailability", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const days = formData.getAll("workDays");
    const parsed = availabilitySchema.safeParse({
      workDays: days,
      workStart: formData.get("workStart"),
      workEnd: formData.get("workEnd"),
      slotMinutes: formData.get("slotMinutes"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Please check the working hours." };
    }
    const d = parsed.data;

    if (d.workStart >= d.workEnd) {
      return { ok: false, error: "The end time must be after the start time." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({
        where: { doctorId: owner.doctorId },
      });
      if (d.workDays.length) {
        await tx.doctorAvailability.createMany({
          data: d.workDays.map((dayOfWeek) => ({
            doctorId: owner.doctorId,
            dayOfWeek,
            startTime: d.workStart,
            endTime: d.workEnd,
            slotMinutes: d.slotMinutes,
            isActive: true,
          })),
        });
      }
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "DoctorAvailability",
      entityId: owner.doctorId,
      after: { self_edit: true, days: d.workDays },
    });

    revalidatePath("/doctor/portal");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}

const timeOffSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
  reason: z.string().trim().max(160).optional().or(z.literal("")),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A doctor blocks out a holiday / leave range on their OWN calendar. Stored as
 * a UTC datetime range (consistent with the UTC slot anchor); the end date is
 * inclusive, so it is stored as the start of the following day.
 */
export async function addOwnTimeOff(formData: FormData): Promise<AdminResult> {
  return runAction("addOwnTimeOff", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = timeOffSchema.safeParse({
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please pick valid dates.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    const startsAt = new Date(`${d.startDate}T00:00:00.000Z`);
    const endsAt = new Date(
      new Date(`${d.endDate}T00:00:00.000Z`).getTime() + DAY_MS
    );
    if (endsAt <= startsAt) {
      return { ok: false, error: "The end date must be on or after the start date." };
    }

    const created = await prisma.doctorTimeOff.create({
      data: {
        doctorId: owner.doctorId,
        startsAt,
        endsAt,
        reason: d.reason || null,
      },
    });

    await audit({
      userId: owner.userId,
      action: "create",
      entity: "DoctorTimeOff",
      entityId: created.id,
      after: { startsAt, endsAt, reason: d.reason || null },
    });

    revalidatePath("/doctor/portal/profile");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

/** Remove one of the doctor's own time-off entries. */
export async function removeOwnTimeOff(id: string): Promise<AdminResult> {
  return runAction("removeOwnTimeOff", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    const result = await prisma.doctorTimeOff.deleteMany({
      where: { id, doctorId: owner.doctorId },
    });
    if (result.count === 0) return { ok: false, error: "Entry not found." };

    await audit({
      userId: owner.userId,
      action: "delete",
      entity: "DoctorTimeOff",
      entityId: id,
    });

    revalidatePath("/doctor/portal/profile");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

const APPOINTMENT_ACTIONS = ["COMPLETED", "NO_SHOW", "CANCELLED"] as const;

/**
 * A doctor updates the status of one of THEIR OWN appointments. The where-clause
 * pins both the appointment id and this doctor's id, so a forged id belonging
 * to another doctor simply matches nothing.
 */
export async function updateOwnAppointmentStatus(
  appointmentId: string,
  status: string
): Promise<AdminResult> {
  return runAction("updateOwnAppointmentStatus", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    const parsed = z.enum(APPOINTMENT_ACTIONS).safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status." };
    const next = parsed.data as AppointmentStatus;

    const result = await prisma.appointment.updateMany({
      where: { id: appointmentId, doctorId: owner.doctorId },
      data: {
        status: next,
        ...(next === AppointmentStatus.CANCELLED
          ? {
              slotLock: null,
              cancelledAt: new Date(),
              cancelReason: "Cancelled by doctor",
            }
          : {}),
      },
    });

    if (result.count === 0) {
      return { ok: false, error: "Appointment not found." };
    }

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appointmentId,
      after: { status: next, by: "doctor" },
    });

    revalidatePath("/doctor/portal");
    revalidatePath("/patient/appointments");
    return { ok: true };
  });
}

/* --------------------------- Prescriptions ------------------------------- */

/**
 * One line of a prescription, as the form submits it.
 *
 * Arrives as parallel repeated inputs — `itemName`, `itemDose` and so on, one
 * of each per row — because that is what a plain HTML form can post without
 * JSON in a hidden field, and a hidden field of JSON is a thing that silently
 * stops matching the form it came from.
 */
const prescribeSchema = z.object({
  /** The appointment being prescribed against — proves the doctor saw them. */
  appointmentId: z.string().trim().min(1),
  title: z.string().trim().min(1, "What are you prescribing?").max(200),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

const ITEM_CAP = 20;

/** Reads the parallel arrays back into rows, dropping anything unnamed. */
function readItems(formData: FormData): {
  medicineId: string | null;
  name: string;
  strength: string | null;
  form: string | null;
  dose: string | null;
  duration: string | null;
}[] {
  const col = (key: string) =>
    formData.getAll(key).map((v) => String(v ?? "").trim());

  const names = col("itemName");
  const ids = col("itemMedicineId");
  const strengths = col("itemStrength");
  const forms = col("itemForm");
  const doses = col("itemDose");
  const durations = col("itemDuration");

  const out: ReturnType<typeof readItems> = [];
  for (let i = 0; i < names.length && out.length < ITEM_CAP; i++) {
    const name = names[i]?.slice(0, 160);
    if (!name) continue;
    out.push({
      medicineId: ids[i] || null,
      name,
      strength: strengths[i]?.slice(0, 60) || null,
      form: forms[i]?.slice(0, 60) || null,
      dose: doses[i]?.slice(0, 160) || null,
      duration: durations[i]?.slice(0, 60) || null,
    });
  }
  return out;
}

/**
 * A clinician issuing a prescription from their own portal.
 *
 * Written against an appointment rather than a patient id, which is what
 * keeps it safe: a doctor can only prescribe to someone whose appointment is
 * theirs. A guest booking (no linked account) has nowhere to file the
 * prescription, so it is refused rather than silently dropped.
 */
export async function issuePrescription(
  formData: FormData
): Promise<AdminResult> {
  return runAction("issuePrescription", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    const parsed = prescribeSchema.safeParse({
      appointmentId: formData.get("appointmentId"),
      title: formData.get("title"),
      notes: formData.get("notes"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the form.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    const appointment = await prisma.appointment.findFirst({
      where: { id: d.appointmentId, doctorId: owner.doctorId },
      select: { id: true, patientUserId: true, patientName: true },
    });
    if (!appointment) {
      return { ok: false, error: "That appointment isn't one of yours." };
    }
    if (!appointment.patientUserId) {
      return {
        ok: false,
        error:
          "This booking has no client account, so there is nowhere to file a prescription.",
      };
    }

    // ── The lines, and which of them came off this doctor's own list ────
    //
    // A prescription used to be a title and a free-text note, typed from
    // memory every time by a doctor who already keeps a list of exactly what
    // they dispense. Picking off that list spells the name the same way twice,
    // carries strength and form without retyping them, and lets the patient
    // order the refill from the practice that prescribed it.
    //
    // Every medicineId is checked against THIS doctor's dispensary before it
    // is stored. A prescription line pointing at a stranger's medicine would
    // put that stranger's price and stock behind a refill button on a patient
    // record they have nothing to do with.
    const submitted = readItems(formData);
    const claimedIds = submitted.map((i) => i.medicineId).filter(Boolean) as string[];
    const ownMedicines = claimedIds.length
      ? await prisma.medicine.findMany({
          where: { id: { in: claimedIds }, doctorId: owner.doctorId },
          select: { id: true, name: true, strength: true, form: true },
        })
      : [];
    const ownById = new Map(ownMedicines.map((m) => [m.id, m]));

    const items = submitted.map((line, i) => {
      const linked = line.medicineId ? ownById.get(line.medicineId) : undefined;
      return {
        // Not ours, or typed freehand: the line still stands, it simply
        // stops being a link. Refusing the whole prescription over it would
        // be the wrong trade in a clinical form.
        medicineId: linked?.id ?? null,
        // Snapshotted at issue, like AftercareSheet's content: this is an
        // instruction the patient acts on, and renaming the catalogue later
        // must never change what they were told to take.
        name: linked?.name ?? line.name,
        strength: line.strength ?? linked?.strength ?? null,
        form: line.form ?? linked?.form ?? null,
        dose: line.dose,
        duration: line.duration,
        sortOrder: i,
      };
    });

    const row = await prisma.prescription.create({
      data: {
        userId: appointment.patientUserId,
        doctorId: owner.doctorId,
        appointmentId: appointment.id,
        title: d.title,
        notes: d.notes || null,
        issuedAt: new Date(),
        ...(items.length ? { items: { create: items } } : {}),
      },
      select: { id: true },
    });

    await audit({
      userId: owner.userId,
      action: "create",
      entity: "Prescription",
      entityId: row.id,
      after: { appointmentId: appointment.id, title: d.title, lines: items.length },
    });

    // It appears in the client's own profile immediately.
    revalidatePath("/patient/profile");
    revalidatePath("/doctor/portal");
    return { ok: true, id: row.id };
  });
}

/* --------------------------- Registration -------------------------------- */

const credentialsSchema = z.object({
  regCouncil: z.string().trim().min(2, "Which council?").max(160),
  regNumber: z.string().trim().min(2, "Your registration number.").max(60),
  regYear: z.coerce
    .number()
    .int()
    .min(1945, "That is before any current registration.")
    .max(new Date().getUTCFullYear(), "A registration cannot be in the future."),
  licenceDocUrl: z.string().trim().max(2000).optional().default(""),
});

/**
 * A practitioner updating their own registration details.
 *
 * ── Why this was missing, and why it could not stay missing ──────────────
 * Registration was captured once during onboarding and then frozen. A doctor
 * who moved state council, renewed a certificate, or simply mistyped a digit
 * had no way to correct it — the one part of their record that the platform
 * makes a public claim about was the one part they could not touch.
 *
 * ── What it costs to change it ───────────────────────────────────────────
 * `verified` is a claim BluDerma makes on every card: that somebody here
 * checked this practitioner against the council's own register. That claim
 * cannot survive the number underneath it changing.
 *
 * So changing the council or the number clears the verified mark and sends
 * the application back for a re-check. The doctor stays live and bookable
 * throughout — delisting somebody for correcting a typo would be absurd —
 * they simply lose the badge until it has been looked at again.
 *
 * Replacing only the CERTIFICATE, with the same council and number, does not
 * clear it. A clearer scan of a document nobody has disputed is not a new
 * claim; it is the same one, legible.
 */
export async function updateOwnCredentials(
  formData: FormData
): Promise<AdminResult> {
  return runAction("updateOwnCredentials", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = credentialsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the form.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    const before = await prisma.doctor.findUniqueOrThrow({
      where: { id: owner.doctorId },
      select: {
        name: true,
        publicId: true,
        regCouncil: true,
        regNumber: true,
        regYear: true,
        licenceDocUrl: true,
        verified: true,
      },
    });

    // The identity of the registration, as opposed to the picture of it.
    const identityChanged =
      (before.regCouncil ?? "") !== d.regCouncil ||
      (before.regNumber ?? "") !== d.regNumber ||
      (before.regYear ?? 0) !== d.regYear;

    await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: {
        regCouncil: d.regCouncil,
        regNumber: d.regNumber,
        regYear: d.regYear,
        // An empty field means "no change", not "remove the certificate":
        // clearing the only evidence of a registration by leaving a box blank
        // is not something a form should let somebody do by accident.
        ...(d.licenceDocUrl ? { licenceDocUrl: d.licenceDocUrl } : {}),
        ...(identityChanged && before.verified ? { verified: false } : {}),
      },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Doctor",
      entityId: owner.doctorId,
      before: {
        regCouncil: before.regCouncil,
        regNumber: before.regNumber,
        regYear: before.regYear,
        verified: before.verified,
      },
      after: {
        regCouncil: d.regCouncil,
        regNumber: d.regNumber,
        regYear: d.regYear,
        verified: identityChanged ? false : before.verified,
      },
    });

    if (identityChanged && before.verified) {
      await sendEmail({
        to: enquiryNotifyAddress(),
        template: "registration-changed",
        relatedId: owner.doctorId,
        subject: `Registration details changed: ${before.name}`,
        text: `${before.name} (${before.publicId ?? "no id"}) has changed their council registration.\n\nWas: ${before.regCouncil ?? "-"} ${before.regNumber ?? "-"} (${before.regYear ?? "-"})\nNow: ${d.regCouncil} ${d.regNumber} (${d.regYear})\n\nThe verified mark has been removed until somebody checks it against the council's register. They remain live and bookable.\n\n- BluDerma`,
        html: `<p><strong>${before.name}</strong> (${before.publicId ?? "no id"}) has changed their council registration.</p><p>Was: ${before.regCouncil ?? "-"} ${before.regNumber ?? "-"} (${before.regYear ?? "-"})<br/>Now: ${d.regCouncil} ${d.regNumber} (${d.regYear})</p><p>The verified mark has been removed until somebody checks it against the council's register. They remain live and bookable.</p><p>- BluDerma</p>`,
      }).catch((e: unknown) => console.error("registration change notice failed", e));
    }

    revalidatePath("/doctor/portal/profile");
    revalidatePath("/admin/doctor-applications");
    return {
      ok: true,
      // Said plainly rather than discovered later from a missing badge.
      message: identityChanged && before.verified
        ? "Saved. Your verified mark is paused while we check the new details against the council's register — you stay listed and bookable in the meantime."
        : "Saved.",
    };
  });
}
