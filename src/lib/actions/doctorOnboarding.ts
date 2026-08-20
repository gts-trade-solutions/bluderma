"use server";

import { revalidatePath } from "next/cache";
import {
  ClinicPhotoKind,
  ConsultMode,
  DoctorStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { audit } from "@/lib/admin/audit";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { blockingGaps, getApplicationGaps } from "@/lib/doctor/gaps";
import { rateLimit } from "@/lib/rateLimit";
import { headers } from "next/headers";
import { sendEmail, enquiryNotifyAddress } from "@/lib/email";

/**
 * Doctor onboarding.
 *
 * Account first, then the rest of the form — one continuous flow, but the
 * login exists from step one. Three reasons, all practical: the clinic
 * photographs and the registration certificate need an authenticated upload
 * endpoint; a long form with images has to survive a closed tab; and an
 * application that is half finished should be visible to us as a real record
 * rather than living in someone's browser.
 *
 * Every step writes straight to the Doctor row, which starts life as DRAFT.
 * DRAFT and PENDING rows are invisible to clients — that is enforced on the
 * read side by PUBLIC_DOCTOR_WHERE, not here.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Adds -2, -3 … until the slug is free. */
async function uniqueSlug(base: string, table: "doctor" | "clinic") {
  const root = base || "practice";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken =
      table === "doctor"
        ? await prisma.doctor.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.clinic.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/* ------------------------- Step 0: the account -------------------------- */

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Tell us your name.").max(120),
    email: z.string().trim().toLowerCase().email("Check that email address."),
    phone: z.string().trim().min(6, "We need a number we can reach you on.").max(20),
    password: z.string().min(8, "At least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Those two passwords do not match.",
  });

/**
 * Creates the login and an empty DRAFT practice in one go.
 *
 * The caller signs in immediately afterwards; this does not create a session
 * itself, because NextAuth owns that and doing it here would mean duplicating
 * its cookie handling.
 */
export async function startDoctorSignup(formData: FormData): Promise<AdminResult> {
  return runAction("startDoctorSignup", async () => {
    // clientIp() takes a Request, which a server action does not have — the
    // proxy headers are still reachable through next/headers.
    const ip =
      headers().get("x-forwarded-for")?.split(",")[0].trim() ||
      headers().get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`doctor-signup:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return { ok: false, error: "Too many sign-up attempts. Try again later." };
    }

    const parsed = parseForm(signupSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    try {
      const doctorSlug = await uniqueSlug(slugify(d.name), "doctor");

      const doctor = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: d.name,
            email: d.email,
            phone: d.phone,
            passwordHash: await hashPassword(d.password),
            role: Role.DOCTOR,
          },
          select: { id: true },
        });

        return tx.doctor.create({
          data: {
            slug: doctorSlug,
            userId: user.id,
            name: d.name,
            phone: d.phone,
            email: d.email,
            // Placeholders the wizard fills in. Empty rather than invented, so
            // a half-finished application never reads as a real listing.
            title: "",
            specialty: "",
            clinic: "",
            location: "",
            image: "",
            about: "",
            status: DoctorStatus.DRAFT,
            // Not visible until an admin says so, twice over.
            isActive: false,
          },
          select: { id: true, slug: true },
        });
      });

      return { ok: true, id: doctor.id };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return {
          ok: false,
          error: "An account with this email already exists.",
          fields: { email: "Already registered — sign in instead." },
        };
      }
      throw err;
    }
  });
}

/* -------------------------- Step 1: about you --------------------------- */

const aboutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2, "e.g. MBBS, MD (Dermatology)").max(160),
  specialty: z.string().trim().min(2, "e.g. Dermatology").max(160),
  experienceYears: z.coerce.number().int().min(0).max(70),
  image: z.string().trim().max(2000).optional().or(z.literal("")),
  about: z
    .string()
    .trim()
    .min(40, "Write at least a couple of sentences — clients read this.")
    .max(2000),
});

export async function saveAboutStep(formData: FormData): Promise<AdminResult> {
  return runAction("saveAboutStep", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = parseForm(aboutSchema, formData);
    if (!parsed.ok) return parsed.result;

    await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: { ...parsed.data, image: parsed.data.image || "" },
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

/* ------------------------- Step 2: credentials -------------------------- */

const credentialsSchema = z.object({
  regCouncil: z
    .string()
    .trim()
    .min(3, "Which council registered you?")
    .max(160),
  regNumber: z.string().trim().min(2, "Your registration number.").max(80),
  regYear: z.coerce
    .number()
    .int()
    .min(1940, "Check that year.")
    .max(new Date().getUTCFullYear(), "That is in the future."),
  licenceDocUrl: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function saveCredentialsStep(
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveCredentialsStep", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = parseForm(credentialsSchema, formData);
    if (!parsed.ok) return parsed.result;

    await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: { ...parsed.data, licenceDocUrl: parsed.data.licenceDocUrl || null },
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

/* --------------------------- Step 3: clinics ---------------------------- */

const clinicSchema = z.object({
  clinicId: z.string().trim().max(40).optional().or(z.literal("")),
  name: z.string().trim().min(2, "What is the clinic called?").max(160),
  addressLine1: z.string().trim().min(4, "Street address.").max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  area: z.string().trim().min(2, "Which neighbourhood?").max(120),
  city: z.string().trim().min(2, "Which city?").max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z.string().trim().regex(/^\d{6}$/, "Six digits."),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  feeInr: z.coerce.number().int().min(0, "Zero means enquiry-only.").max(200000),
  exteriorImage: z.string().trim().max(2000).optional().or(z.literal("")),
  interiorImage: z.string().trim().max(2000).optional().or(z.literal("")),
  facilities: z.string().trim().max(600).optional().or(z.literal("")),
  isPrimary: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

/**
 * Adds or edits one location.
 *
 * A clinic is created fresh per doctor rather than matched by name to an
 * existing one. Fuzzy-matching "Skin Clinic, Anna Nagar" onto somebody else's
 * record would silently attach a stranger's practice to their listing, which
 * is a much worse failure than two similar rows an admin can merge later.
 */
export async function saveClinicStep(formData: FormData): Promise<AdminResult> {
  return runAction("saveClinicStep", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = parseForm(clinicSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    const existingCount = await prisma.doctorClinic.count({
      where: { doctorId: owner.doctorId },
    });
    // The first location a doctor adds is their primary whether they ticked
    // the box or not — a practice with no primary has nothing to show on a card.
    const makePrimary = d.isPrimary || existingCount === 0;

    const clinicId = await prisma.$transaction(async (tx) => {
      let id = d.clinicId || null;

      if (id) {
        // Only a location this doctor actually practises at.
        const link = await tx.doctorClinic.findUnique({
          where: { doctorId_clinicId: { doctorId: owner.doctorId, clinicId: id } },
          select: { clinicId: true },
        });
        if (!link) throw new Error("not_your_clinic");

        await tx.clinic.update({
          where: { id },
          data: {
            name: d.name,
            addressLine1: d.addressLine1,
            addressLine2: d.addressLine2 || null,
            area: d.area,
            city: d.city,
            state: d.state,
            pincode: d.pincode,
            phone: d.phone || null,
          },
        });
      } else {
        const created = await tx.clinic.create({
          data: {
            slug: await uniqueSlug(slugify(`${d.name}-${d.area}`), "clinic"),
            name: d.name,
            addressLine1: d.addressLine1,
            addressLine2: d.addressLine2 || null,
            area: d.area,
            city: d.city,
            state: d.state,
            pincode: d.pincode,
            phone: d.phone || null,
            // Cycles through the calendar palette so a doctor's locations are
            // distinguishable from the moment they are added.
            colorKey: CLINIC_PALETTE[existingCount % CLINIC_PALETTE.length],
            // Live only once the practitioner is approved.
            isActive: false,
          },
          select: { id: true },
        });
        id = created.id;
      }

      if (makePrimary) {
        await tx.doctorClinic.updateMany({
          where: { doctorId: owner.doctorId },
          data: { isPrimary: false },
        });
      }

      await tx.doctorClinic.upsert({
        where: { doctorId_clinicId: { doctorId: owner.doctorId, clinicId: id! } },
        update: { feeInr: d.feeInr, isPrimary: makePrimary },
        create: {
          doctorId: owner.doctorId,
          clinicId: id!,
          feeInr: d.feeInr,
          isPrimary: makePrimary,
          sortOrder: existingCount,
        },
      });

      // Photographs. Replaced rather than appended, because these two slots are
      // "the outside" and "the inside" — there is only one of each.
      for (const [kind, url] of [
        [ClinicPhotoKind.EXTERIOR, d.exteriorImage],
        [ClinicPhotoKind.INTERIOR, d.interiorImage],
      ] as const) {
        await tx.clinicPhoto.deleteMany({ where: { clinicId: id!, kind } });
        if (url) {
          await tx.clinicPhoto.create({
            data: { clinicId: id!, kind, url, alt: `${d.name} ${kind.toLowerCase()}` },
          });
        }
      }

      const facilities = (d.facilities || "")
        .split(/[\n,]/)
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 20);
      await tx.clinicFacility.deleteMany({ where: { clinicId: id! } });
      if (facilities.length) {
        await tx.clinicFacility.createMany({
          data: facilities.map((name, i) => ({ clinicId: id!, name, sortOrder: i })),
          skipDuplicates: true,
        });
      }

      if (makePrimary) {
        await tx.doctor.update({
          where: { id: owner.doctorId },
          data: { clinic: d.name, location: d.city, fee: d.feeInr },
        });
      }

      return id!;
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    revalidatePath("/doctor/portal/practice");
    return { ok: true, id: clinicId };
  });
}

const CLINIC_PALETTE = [
  "blue",
  "teal",
  "violet",
  "emerald",
  "amber",
  "rose",
  "indigo",
  "orange",
  "sky",
];

export async function removeClinic(clinicId: string): Promise<AdminResult> {
  return runAction("removeClinic", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    const booked = await prisma.appointment.count({
      where: { doctorId: owner.doctorId, clinicId, scheduledAt: { gte: new Date() } },
    });
    if (booked > 0) {
      return {
        ok: false,
        error: `You have ${booked} upcoming ${
          booked === 1 ? "appointment" : "appointments"
        } there. Move or cancel them before removing the location.`,
      };
    }

    await prisma.$transaction([
      prisma.doctorAvailability.deleteMany({ where: { doctorId: owner.doctorId, clinicId } }),
      prisma.doctorClinic.deleteMany({ where: { doctorId: owner.doctorId, clinicId } }),
    ]);

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    revalidatePath("/doctor/portal/practice");
    return { ok: true };
  });
}

/* ---------------------------- Step 4: hours ----------------------------- */

const hoursSchema = z.object({
  clinicId: z.string().trim().min(1),
  days: z.union([z.string(), z.array(z.string())]).transform((v) =>
    (Array.isArray(v) ? v : [v]).map(Number).filter((n) => n >= 0 && n <= 6)
  ),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
  slotMinutes: z.coerce.number().int().min(5).max(180),
});

/**
 * Adds one working window.
 *
 * Windows accumulate rather than replace, because a morning and an evening
 * session on the same day is the normal Indian pattern and the whole point of
 * keeping startTime in the unique key.
 */
export async function addHoursStep(formData: FormData): Promise<AdminResult> {
  return runAction("addHoursStep", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = parseForm(hoursSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    if (d.days.length === 0) {
      return { ok: false, error: "Pick at least one day.", fields: { days: "Pick a day." } };
    }
    if (d.endTime <= d.startTime) {
      return {
        ok: false,
        error: "The finish time has to be after the start.",
        fields: { endTime: "Must be after the start time." },
      };
    }

    const link = await prisma.doctorClinic.findUnique({
      where: { doctorId_clinicId: { doctorId: owner.doctorId, clinicId: d.clinicId } },
      select: { clinicId: true },
    });
    if (!link) return { ok: false, error: "That is not one of your locations." };

    for (const day of d.days) {
      await prisma.doctorAvailability.upsert({
        where: {
          doctorId_clinicId_dayOfWeek_startTime: {
            doctorId: owner.doctorId,
            clinicId: d.clinicId,
            dayOfWeek: day,
            startTime: d.startTime,
          },
        },
        update: { endTime: d.endTime, slotMinutes: d.slotMinutes, isActive: true },
        create: {
          doctorId: owner.doctorId,
          clinicId: d.clinicId,
          dayOfWeek: day,
          startTime: d.startTime,
          endTime: d.endTime,
          slotMinutes: d.slotMinutes,
        },
      });
    }

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    revalidatePath("/doctor/portal/practice");
    return { ok: true };
  });
}

export async function removeHours(availabilityId: string): Promise<AdminResult> {
  return runAction("removeHours", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    // Pinned to the doctor, so an id from somewhere else deletes nothing.
    await prisma.doctorAvailability.deleteMany({
      where: { id: availabilityId, doctorId: owner.doctorId },
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    revalidatePath("/doctor/portal/practice");
    return { ok: true };
  });
}

/* ------------------------ Step 5: how you consult ----------------------- */

const consultSchema = z.object({
  offersClinic: z.string().optional(),
  offersVideo: z.string().optional(),
  offersHome: z.string().optional(),
  languages: z.string().trim().max(400).optional().or(z.literal("")),
  services: z.union([z.string(), z.array(z.string())]).optional(),
  concerns: z.union([z.string(), z.array(z.string())]).optional(),
  travelBufferMin: z.coerce.number().int().min(0).max(240).default(0),
  requiresApproval: z.string().optional(),
});

/**
 * Normalises a list field to trimmed, deduped names.
 *
 * Accepts either shape: the chip picker submits repeated inputs (which
 * formToObject collapses into an array) while the textarea submits one string,
 * and /doctor/portal/practice still renders the textarea version.
 */
const lines = (v: string | string[] | undefined, cap: number) => {
  const raw = Array.isArray(v) ? v : (v || "").split(/[\n,]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
};

export async function saveConsultStep(formData: FormData): Promise<AdminResult> {
  return runAction("saveConsultStep", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = parseForm(consultSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    const modes: ConsultMode[] = [];
    if (d.offersClinic) modes.push(ConsultMode.CLINIC);
    if (d.offersVideo) modes.push(ConsultMode.VIDEO);
    // HOME has existed in the enum and been accepted by the booking action
    // since the beginning, but nothing ever wrote it. This is the first place
    // a doctor can actually say they do home visits.
    if (d.offersHome) modes.push(ConsultMode.HOME);

    if (modes.length === 0) {
      return { ok: false, error: "Pick at least one way you see clients." };
    }

    const concernKeys = (
      Array.isArray(d.concerns) ? d.concerns : d.concerns ? [d.concerns] : []
    ).slice(0, 30);

    await prisma.$transaction(async (tx) => {
      await tx.doctorMode.deleteMany({ where: { doctorId: owner.doctorId } });
      await tx.doctorMode.createMany({
        data: modes.map((mode) => ({ doctorId: owner.doctorId, mode })),
      });

      await tx.doctorLanguage.deleteMany({ where: { doctorId: owner.doctorId } });
      const langs = lines(d.languages, 12);
      if (langs.length) {
        await tx.doctorLanguage.createMany({
          data: langs.map((name, i) => ({ doctorId: owner.doctorId, name, sortOrder: i })),
          skipDuplicates: true,
        });
      }

      await tx.doctorService.deleteMany({ where: { doctorId: owner.doctorId } });
      const svcs = lines(d.services, 40);
      if (svcs.length) {
        await tx.doctorService.createMany({
          data: svcs.map((name, i) => ({ doctorId: owner.doctorId, name, sortOrder: i })),
          skipDuplicates: true,
        });
      }

      if (concernKeys.length) {
        const concerns = await tx.skinConcern.findMany({
          where: { key: { in: concernKeys } },
          select: { id: true },
        });
        await tx.doctorConcern.deleteMany({ where: { doctorId: owner.doctorId } });
        if (concerns.length) {
          await tx.doctorConcern.createMany({
            data: concerns.map((c) => ({ doctorId: owner.doctorId, concernId: c.id })),
            skipDuplicates: true,
          });
        }
      }

      await tx.doctor.update({
        where: { id: owner.doctorId },
        data: {
          travelBufferMin: d.travelBufferMin,
          requiresApproval: Boolean(d.requiresApproval),
        },
      });
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

/* ---------------------------- Submit for review ------------------------- */

export async function submitApplication(): Promise<AdminResult> {
  return runAction("submitApplication", async () => {
    const user = await getCurrentUser();
    const owner = await getOwnDoctor();
    if (!owner || !user) return { ok: false, error: "Start your application first." };

    if (owner.status === DoctorStatus.PENDING) return { ok: true };
    if (owner.status === DoctorStatus.APPROVED) {
      return { ok: false, error: "Your profile is already live." };
    }

    const gaps = blockingGaps(await getApplicationGaps(owner.doctorId));
    if (gaps.length) {
      return {
        ok: false,
        error: `Still needed: ${gaps
          .map((g) => g.label)
          .join(", ")
          .toLowerCase()}.`,
      };
    }

    await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: {
        status: DoctorStatus.PENDING,
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });

    await audit({
      userId: user.id,
      action: "update",
      entity: "Doctor",
      entityId: owner.doctorId,
      before: { status: owner.status },
      after: { status: DoctorStatus.PENDING },
    });

    // Nobody is watching a queue that nothing announces.
    await sendEmail({
      to: enquiryNotifyAddress(),
      template: "enquiry-notification",
      relatedId: owner.doctorId,
      subject: `Doctor application: ${owner.name}`,
      text: `${owner.name} has submitted a practitioner application for review.\n\nReview it at /admin/doctor-applications`,
      html: `<p><strong>${owner.name}</strong> has submitted a practitioner application for review.</p><p>Review it at /admin/doctor-applications</p>`,
    }).catch((e) => console.error("application notice failed", e));

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    revalidatePath("/doctor/portal");
    revalidatePath("/admin/doctor-applications");
    return { ok: true };
  });
}
