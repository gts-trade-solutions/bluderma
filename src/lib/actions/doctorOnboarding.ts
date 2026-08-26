"use server";

import { newDoctorId, newPatientId } from "@/lib/publicId";
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
import { asArray, type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { blockingGaps, getApplicationGaps } from "@/lib/doctor/gaps";
import { rateLimit } from "@/lib/rateLimit";
import { categoryOf } from "@/data/facilities";
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
            publicId: newPatientId(),
          },
          select: { id: true },
        });

        return tx.doctor.create({
          data: {
            slug: doctorSlug,
            userId: user.id,
            // Deliberately unlike a patient id: both appear on the same
            // aftercare sheet, so a glance has to tell them apart.
            publicId: newDoctorId(),
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
          fields: { email: "Already registered: sign in instead." },
        };
      }
      throw err;
    }
  });
}

/* -------------------------- Step 1: about you --------------------------- */

/**
 * Promotes the signed-in account to a practitioner.
 *
 * Google (and any OAuth) sign-in always creates a PATIENT — the NextAuth
 * adapter has no notion of "sign up as a doctor". This is the bridge: someone
 * who chose "continue as a doctor with Google" arrives here already
 * authenticated as a client, and this flips their role to DOCTOR. The draft
 * practice itself is made by ensurePractice() the moment they next load
 * /doctor/join, so this owns only the role change. Idempotent; ADMIN is left
 * untouched (an admin visiting the bootstrap must not be demoted into the
 * directory).
 */
export async function promoteCurrentUserToDoctor(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (user.role === Role.PATIENT) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.DOCTOR },
    });
  }
  return { ok: true };
}

const aboutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2, "e.g. MBBS, MD (Dermatology)").max(160),
  specialty: z.string().trim().min(2, "e.g. Dermatology").max(160),
  experienceYears: z.coerce.number().int().min(0).max(70),
  image: z.string().trim().max(2000).optional().or(z.literal("")),
  about: z
    .string()
    .trim()
    .min(40, "Write at least a couple of sentences. Clients read this.")
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

/**
 * A coordinate that may legitimately be absent.
 *
 * NOT `z.coerce.number().optional().or(z.literal(""))`: coercion turns "" into
 * 0 before the union is ever consulted, so an empty field would silently
 * become latitude 0, longitude 0 — a point in the Gulf of Guinea, and a clinic
 * that would then appear at the top of every "nearest to me" list computed
 * from a distance to it.
 */
const optionalCoord = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(min).max(max).optional()
  );

const clinicSchema = z.object({
  clinicId: z.string().trim().max(40).optional().or(z.literal("")),
  /**
   * Set when the practitioner picked an existing clinic out of the "already
   * on BluDerma" suggestions instead of describing a new one. Everything
   * below except feeInr and isPrimary is then ignored: they are joining
   * somebody else's premises, not redescribing them.
   */
  joinClinicId: z.string().trim().max(40).optional().or(z.literal("")),
  name: z.string().trim().min(2, "What is the clinic called?").max(160),
  addressLine1: z.string().trim().min(4, "Street address.").max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  area: z.string().trim().min(2, "Which neighbourhood?").max(120),
  landmark: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Which city?").max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z.string().trim().regex(/^\d{6}$/, "Six digits."),
  /**
   * Coordinates from the map picker. Blank is the norm and always allowed —
   * the pin is optional, and a clinic that never drops one must still be able
   * to finish onboarding.
   */
  lat: optionalCoord(-90, 90),
  lng: optionalCoord(-180, 180),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  feeInr: z.coerce.number().int().min(0, "Zero means enquiry-only.").max(200000),
  exteriorImage: z.string().trim().max(2000).optional().or(z.literal("")),
  interiorImage: z.string().trim().max(2000).optional().or(z.literal("")),
  /**
   * Repeated inputs from the facilities picker, which formToObject collapses
   * into an array. The old comma-separated string is still accepted so the
   * admin screens that post one keep working.
   */
  facilities: z.union([z.string(), z.array(z.string())]).optional(),
  isPrimary: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

/**
 * Adds one location, joins an existing one, or edits one.
 *
 * -- Clinics are shared, and now the form knows it ------------------------
 * This used to create a brand-new Clinic row every time, with a note
 * explaining that fuzzy-matching a stranger's practice onto somebody's
 * listing was worse than duplicate rows an admin could merge. That reasoning
 * still holds for AUTOMATIC matching and is why none happens. What changed is
 * that the practitioner is now shown the candidates and presses the button
 * themselves - see /api/clinics/match. Three dermatologists at one Anna Nagar
 * address stop producing three clinics, three addresses and three map pins.
 *
 * -- Who may edit a shared clinic -----------------------------------------
 * Only the practitioner who is its sole occupant. The moment a second doctor
 * holds hours there, the shared fields - name, address, landmark, pin,
 * photographs, facilities - become read-only to everyone, and only the
 * doctor-specific fee and primary flag stay writable.
 *
 * The alternative was letting any linked doctor edit them, and that is a
 * stranger being able to rename your clinic, move its pin and replace its
 * photographs from inside their own onboarding form, with no notification and
 * no audit trail. A correction to a shared clinic goes through an admin,
 * which is slower and is the right trade for premises several practices
 * depend on.
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
    // the box or not - a practice with no primary has nothing to show on a card.
    const makePrimary = d.isPrimary || existingCount === 0;

    // -- Joining somebody else's clinic ---------------------------------
    // A separate branch rather than a flag inside the one below, because
    // almost nothing about it is the same: no clinic row is written, no
    // photograph is replaced, no facility is touched. Only the join.
    if (d.joinClinicId) {
      const target = await prisma.clinic.findUnique({
        where: { id: d.joinClinicId },
        select: { id: true, name: true, city: true },
      });
      if (!target) {
        return {
          ok: false,
          error: "That clinic no longer exists. Add it as a new location instead.",
        };
      }

      const already = await prisma.doctorClinic.findUnique({
        where: {
          doctorId_clinicId: { doctorId: owner.doctorId, clinicId: target.id },
        },
        select: { clinicId: true },
      });
      if (already) {
        return { ok: false, error: "You already practise at that location." };
      }

      await prisma.$transaction(async (tx) => {
        if (makePrimary) {
          await tx.doctorClinic.updateMany({
            where: { doctorId: owner.doctorId },
            data: { isPrimary: false },
          });
        }
        await tx.doctorClinic.create({
          data: {
            doctorId: owner.doctorId,
            clinicId: target.id,
            feeInr: d.feeInr,
            isPrimary: makePrimary,
            sortOrder: existingCount,
          },
        });
        if (makePrimary) {
          await tx.doctor.update({
            where: { id: owner.doctorId },
            data: { clinic: target.name, location: target.city, fee: d.feeInr },
          });
        }
      });

      revalidatePath("/doctor/portal");
      revalidatePath("/doctor/portal/practice");
      return { ok: true, id: target.id };
    }

    // -- Creating or editing a location of their own --------------------
    const clinicId = await prisma.$transaction(async (tx) => {
      let id = d.clinicId || null;
      // Whether the shared fields may be written. True for a brand-new
      // clinic; for an existing one, only while nobody else works there.
      let mayEditShared = true;

      if (id) {
        // Only a location this doctor actually practises at.
        const link = await tx.doctorClinic.findUnique({
          where: { doctorId_clinicId: { doctorId: owner.doctorId, clinicId: id } },
          select: { clinicId: true },
        });
        if (!link) throw new Error("not_your_clinic");

        const occupants = await tx.doctorClinic.count({ where: { clinicId: id } });
        mayEditShared = occupants <= 1;

        if (mayEditShared) {
          await tx.clinic.update({
            where: { id },
            data: {
              name: d.name,
              addressLine1: d.addressLine1,
              addressLine2: d.addressLine2 || null,
              area: d.area,
              landmark: d.landmark || null,
              city: d.city,
              state: d.state,
              pincode: d.pincode,
              phone: d.phone || null,
              // Both or neither: half a coordinate pair is not a location.
              lat: d.lat ?? null,
              lng: d.lng ?? null,
            },
          });
        }
      } else {
        const created = await tx.clinic.create({
          data: {
            slug: await uniqueSlug(slugify(`${d.name}-${d.area}`), "clinic"),
            name: d.name,
            addressLine1: d.addressLine1,
            addressLine2: d.addressLine2 || null,
            area: d.area,
            landmark: d.landmark || null,
            city: d.city,
            state: d.state,
            pincode: d.pincode,
            lat: d.lat ?? null,
            lng: d.lng ?? null,
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

      if (mayEditShared) {
        // Photographs. Replaced rather than appended, because these two slots
        // are "the outside" and "the inside" - there is only one of each.
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

        // The picker posts one input per facility; the older admin forms post
        // one comma-separated string. Both land here.
        const facilities = asArray(d.facilities)
          .flatMap((f) => (f.includes(",") ? f.split(",") : [f]))
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, 40);

        await tx.clinicFacility.deleteMany({ where: { clinicId: id! } });
        if (facilities.length) {
          await tx.clinicFacility.createMany({
            data: facilities.map((name, i) => ({
              clinicId: id!,
              name,
              // Null for anything the practitioner typed themselves, which is
              // how the clinic page tells curated from custom.
              category: categoryOf(name),
              sortOrder: i,
            })),
            skipDuplicates: true,
          });
        }
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
  // All four accept either shape: the pickers submit repeated inputs, which
  // formToObject collapses into an array, while /doctor/portal/practice and
  // the admin screens still post one comma-separated string.
  languages: z.union([z.string(), z.array(z.string())]).optional(),
  services: z.union([z.string(), z.array(z.string())]).optional(),
  specialtyAreas: z.union([z.string(), z.array(z.string())]).optional(),
  concerns: z.union([z.string(), z.array(z.string())]).optional(),
  otherConcerns: z.union([z.string(), z.array(z.string())]).optional(),
  // The diary levers are no longer asked for during onboarding — they live in
  // My practice (savePracticeSettings), where a doctor changes them once they
  // have a diary to have an opinion about.
  //
  // They stay in this schema behind a marker rather than being deleted from
  // it, because an unticked checkbox and an absent field are indistinguishable
  // in a FormData: without an explicit "this submission carries them" flag,
  // every save of a doctor's languages would silently reset requiresApproval
  // to false. No form sets the marker today, which is the intended state —
  // this step no longer owns those two columns.
  diarySettings: z.string().optional(),
  travelBufferMin: z.coerce.number().int().min(0).max(240).optional(),
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

      // Areas of speciality: what the practitioner is known FOR, which is
      // neither their qualification line nor their procedure list.
      await tx.doctorSpecialtyArea.deleteMany({
        where: { doctorId: owner.doctorId },
      });
      const areas = lines(d.specialtyAreas, 8);
      if (areas.length) {
        await tx.doctorSpecialtyArea.createMany({
          data: areas.map((name, i) => ({ doctorId: owner.doctorId, name, sortOrder: i })),
          skipDuplicates: true,
        });
      }

      // Concerns the catalogue has no row for. Stored, shown, and pointedly
      // NOT joined to the analyzer's matching index — see DoctorConcernOther.
      await tx.doctorConcernOther.deleteMany({
        where: { doctorId: owner.doctorId },
      });
      const extra = lines(d.otherConcerns, 12);
      if (extra.length) {
        await tx.doctorConcernOther.createMany({
          data: extra.map((name, i) => ({ doctorId: owner.doctorId, name, sortOrder: i })),
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

      if (d.diarySettings) {
        await tx.doctor.update({
          where: { id: owner.doctorId },
          data: {
            travelBufferMin: d.travelBufferMin ?? 0,
            requiresApproval: Boolean(d.requiresApproval),
          },
        });
      }
    });

    revalidatePath("/doctor/join");
    revalidatePath("/doctor/portal");
    return { ok: true };
  });
}

/* ------------------------ The last question, on review ------------------ */

/**
 * "Are you listed on any other consultation platform?"
 *
 * Takes an object rather than FormData because it saves as the practitioner
 * answers rather than on a submit — see the note in ListedElsewhere.tsx for
 * why it is not a second button next to the real one.
 *
 * `null` is a real, storable answer and means "not said". Nothing infers
 * "no" from silence: the admin reviewing an application can tell a
 * practitioner who answered no from one who skipped it, and those are
 * different facts.
 */
export async function saveListedElsewhere(input: {
  listedElsewhere: boolean | null;
  names: string;
}): Promise<AdminResult> {
  return runAction("saveListedElsewhere", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "Start your application first." };

    const parsed = z
      .object({
        listedElsewhere: z.boolean().nullable(),
        names: z.string().trim().max(300),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "Could not save that." };

    await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: {
        listedElsewhere: parsed.data.listedElsewhere,
        // Only meaningful alongside a yes. Clearing it when the answer is no
        // or unset stops a stale list of platforms outliving the claim.
        listedElsewhereNames:
          parsed.data.listedElsewhere === true
            ? parsed.data.names || null
            : null,
      },
    });

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
