"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";

/**
 * The marketing rails on the explore hub: deals, carousel promos and the
 * concern tiles.
 *
 * These are the most time-sensitive content on the site — a fortnight's offer
 * is worthless the day after it ends — so all three carry their own start and
 * end dates and stop showing themselves. Until now they were hard-coded, and
 * changing an offer meant a developer and a deploy.
 *
 * Deals advertise a percentage and never a rupee figure, because the
 * catalogue is price-free by design.
 */

const dateish = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    if (!v) return null;
    const d = new Date(`${v}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const slug = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens.");

/* --------------------------------- Deals -------------------------------- */

const dealSchema = z.object({
  slug,
  title: z.string().trim().min(1, "A title is required.").max(200),
  treatment: z.string().trim().min(1, "Name the treatment.").max(200),
  categorySlug: z.string().trim().min(1, "Pick a category.").max(120),
  categoryLabel: z.string().trim().min(1).max(120),
  image: z.string().trim().min(1, "An image is required.").max(2000),
  discount: z.coerce.number().int().min(1).max(90),
  perk: z.string().trim().min(1, "What does the deal include?").max(200),
  claimed: z.coerce.number().int().min(0).max(100000).default(0),
  endsIn: z.string().trim().min(1, "Say when it ends.").max(80),
  isHot: checkbox,
  startsAt: dateish,
  endsAt: dateish,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: checkbox,
});

export async function saveHubDeal(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveHubDeal", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(dealSchema, formData);
    if (!parsed.ok) return parsed.result;

    const data = parsed.data;

    const before = id ? await prisma.hubDeal.findUnique({ where: { id } }) : null;
    const row = id
      ? await prisma.hubDeal.update({ where: { id }, data })
      : await prisma.hubDeal.create({ data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "HubDeal",
      entityId: row.id,
      before,
      after: row,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/deals");
    return { ok: true, id: row.id };
  });
}

export async function deleteHubDeal(id: string): Promise<AdminResult> {
  return runAction("deleteHubDeal", async () => {
    const user = await requireAdminUser();
    const before = await prisma.hubDeal.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "That deal no longer exists." };

    await prisma.hubDeal.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "HubDeal",
      entityId: id,
      before,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/deals");
    return { ok: true };
  });
}

/* -------------------------------- Promos -------------------------------- */

const promoSchema = z.object({
  slug,
  eyebrow: z.string().trim().min(1, "An eyebrow line is required.").max(120),
  title: z.string().trim().min(1, "A title is required.").max(200),
  body: z.string().trim().min(1, "A body line is required.").max(500),
  image: z.string().trim().min(1, "An image is required.").max(2000),
  cta: z.string().trim().min(1, "Give the button a label.").max(80),
  href: z.string().trim().min(1, "Where does the button go?").max(500),
  startsAt: dateish,
  endsAt: dateish,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: checkbox,
});

export async function saveHubPromo(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveHubPromo", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(promoSchema, formData);
    if (!parsed.ok) return parsed.result;

    const data = parsed.data;

    const before = id ? await prisma.hubPromo.findUnique({ where: { id } }) : null;
    const row = id
      ? await prisma.hubPromo.update({ where: { id }, data })
      : await prisma.hubPromo.create({ data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "HubPromo",
      entityId: row.id,
      before,
      after: row,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/promos");
    return { ok: true, id: row.id };
  });
}

export async function deleteHubPromo(id: string): Promise<AdminResult> {
  return runAction("deleteHubPromo", async () => {
    const user = await requireAdminUser();
    const before = await prisma.hubPromo.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "That promo no longer exists." };

    await prisma.hubPromo.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "HubPromo",
      entityId: id,
      before,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/promos");
    return { ok: true };
  });
}

/* ------------------------------- Concerns ------------------------------- */

const concernSchema = z.object({
  slug,
  label: z.string().trim().min(1, "A label is required.").max(120),
  hint: z.string().trim().min(1, "A one-line hint is required.").max(200),
  image: z.string().trim().min(1, "An image is required.").max(2000),
  category: z.string().trim().min(1, "Pick the category it opens.").max(120),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: checkbox,
});

export async function saveHubConcern(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveHubConcern", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(concernSchema, formData);
    if (!parsed.ok) return parsed.result;

    const before = id
      ? await prisma.hubConcern.findUnique({ where: { id } })
      : null;
    const row = id
      ? await prisma.hubConcern.update({ where: { id }, data: parsed.data })
      : await prisma.hubConcern.create({ data: parsed.data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "HubConcern",
      entityId: row.id,
      before,
      after: row,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/concerns");
    return { ok: true, id: row.id };
  });
}

export async function deleteHubConcern(id: string): Promise<AdminResult> {
  return runAction("deleteHubConcern", async () => {
    const user = await requireAdminUser();
    const before = await prisma.hubConcern.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "That concern no longer exists." };

    await prisma.hubConcern.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "HubConcern",
      entityId: id,
      before,
    });

    revalidatePath("/patient/explore");
    revalidatePath("/admin/concerns");
    return { ok: true };
  });
}
