"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  hubCategorySchema,
  hubTreatmentSchema,
  protocolSchema,
} from "@/lib/admin/schemas";

/**
 * Admin CRUD for the client-facing catalogue: the explore hub's categories,
 * their treatments, and the clinical protocol each category's treatment pages
 * render.
 *
 * Every save revalidates the hub and the treatment pages under it — the
 * catalogue is heavily cached, and content that does not appear until the next
 * deploy is not really editable.
 */

/** Prisma's Json input wants structural values; our interfaces have no index signature. */
const json = (v: unknown) => v as Prisma.InputJsonValue;

function revalidateHub(categorySlug?: string) {
  revalidatePath("/patient/explore");
  revalidatePath("/");
  if (categorySlug) {
    revalidatePath(`/patient/explore/${categorySlug}`);
    // The treatment pages under it are dynamic segments; revalidating the
    // layout path covers every child.
    revalidatePath(`/patient/explore/${categorySlug}/[treatment]`, "page");
  }
}

/* ------------------------------- Categories ------------------------------ */

export async function saveHubCategory(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveHubCategory", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(hubCategorySchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const before = id
      ? await prisma.hubCategory.findUnique({ where: { id } })
      : null;

    const row = id
      ? await prisma.hubCategory.update({ where: { id }, data: d })
      : await prisma.hubCategory.create({ data: d });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "HubCategory",
      entityId: row.id,
      before,
      after: row,
    });

    revalidateHub(row.slug);
    if (before && before.slug !== row.slug) revalidateHub(before.slug);
    revalidatePath("/admin/hub-categories");
    return { ok: true, id: row.id };
  });
}

export async function deleteHubCategory(id: string): Promise<AdminResult> {
  return runAction("deleteHubCategory", async () => {
    const user = await requireAdminUser();
    const before = await prisma.hubCategory.findUnique({
      where: { id },
      include: { _count: { select: { treatments: true } } },
    });
    if (!before) return { ok: false, error: "That category no longer exists." };

    // Cascade removes its treatments and protocol — say so rather than
    // silently deleting a hundred pages' worth of content.
    await prisma.hubCategory.delete({ where: { id } });

    await audit({
      userId: user.id,
      action: "delete",
      entity: "HubCategory",
      entityId: id,
      before,
    });

    revalidateHub(before.slug);
    revalidatePath("/admin/hub-categories");
    return { ok: true };
  });
}

/* ------------------------------- Treatments ------------------------------ */

export async function saveHubTreatment(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveHubTreatment", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(hubTreatmentSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      categoryId: d.categoryId,
      slug: d.slug,
      name: d.name,
      blurb: d.blurb,
      image: d.image,
      beforeImage: d.beforeImage || null,
      afterImage: d.afterImage || null,
      meta: d.meta || null,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    };

    const before = id
      ? await prisma.hubTreatment.findUnique({
          where: { id },
          include: { category: { select: { slug: true } } },
        })
      : null;

    try {
      const row = id
        ? await prisma.hubTreatment.update({ where: { id }, data })
        : await prisma.hubTreatment.create({ data });

      const category = await prisma.hubCategory.findUnique({
        where: { id: row.categoryId },
        select: { slug: true },
      });

      await audit({
        userId: user.id,
        action: id ? "update" : "create",
        entity: "HubTreatment",
        entityId: row.id,
        before,
        after: row,
      });

      revalidateHub(category?.slug);
      if (before?.category.slug && before.category.slug !== category?.slug) {
        revalidateHub(before.category.slug);
      }
      revalidatePath("/admin/hub-treatments");
      return { ok: true, id: row.id };
    } catch (err) {
      // The slug only has to be unique inside its category, which is exactly
      // the collision an editor is most likely to cause.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return {
          ok: false,
          error: "Another treatment in this category already uses that slug.",
        };
      }
      throw err;
    }
  });
}

export async function deleteHubTreatment(id: string): Promise<AdminResult> {
  return runAction("deleteHubTreatment", async () => {
    const user = await requireAdminUser();
    const before = await prisma.hubTreatment.findUnique({
      where: { id },
      include: { category: { select: { slug: true } } },
    });
    if (!before) return { ok: false, error: "That treatment no longer exists." };

    await prisma.hubTreatment.delete({ where: { id } });

    await audit({
      userId: user.id,
      action: "delete",
      entity: "HubTreatment",
      entityId: id,
      before,
    });

    revalidateHub(before.category.slug);
    revalidatePath("/admin/hub-treatments");
    return { ok: true };
  });
}

/* -------------------------------- Protocol ------------------------------- */

/** "Name | what differs | popular" → a TreatmentOption. */
function parseOptions(rows: string[]) {
  return rows.map((row) => {
    const [name = "", detail = "", flag = ""] = row.split("|").map((s) => s.trim());
    return { name, detail, popular: /^(popular|yes|true|1)$/i.test(flag) };
  });
}

/** "Question | Answer" → a TreatmentFaq. */
function parseFaqs(rows: string[]) {
  return rows.map((row) => {
    const idx = row.indexOf("|");
    return idx === -1
      ? { q: row.trim(), a: "" }
      : { q: row.slice(0, idx).trim(), a: row.slice(idx + 1).trim() };
  });
}

export async function saveProtocol(formData: FormData): Promise<AdminResult> {
  return runAction("saveProtocol", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(protocolSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const category = await prisma.hubCategory.findUnique({
      where: { id: d.categoryId },
      select: { slug: true },
    });
    if (!category) return { ok: false, error: "That category no longer exists." };

    const data = {
      recommendedFor: json(d.recommendedFor),
      summary: d.summary,
      howItWorks: d.howItWorks,
      options: json(parseOptions(d.options)),
      areas: json(d.areas),
      duration: d.duration,
      anaesthesia: d.anaesthesia,
      sessions: d.sessions,
      downtime: d.downtime,
      results: d.results,
      includes: json(d.includes),
      excludes: json(d.excludes),
      precautions: json(d.precautions),
      sideEffects: json(d.sideEffects),
      notSuitable: json(d.notSuitable),
      aftercare: json(d.aftercare),
      faqs: json(parseFaqs(d.faqs)),
    };

    const before = await prisma.treatmentProtocol.findUnique({
      where: { categoryId: d.categoryId },
    });

    const row = await prisma.treatmentProtocol.upsert({
      where: { categoryId: d.categoryId },
      create: { categoryId: d.categoryId, ...data },
      update: data,
    });

    await audit({
      userId: user.id,
      action: before ? "update" : "create",
      entity: "TreatmentProtocol",
      entityId: row.id,
      before,
      after: row,
    });

    revalidateHub(category.slug);
    revalidatePath("/admin/hub-categories");
    return { ok: true, id: row.id };
  });
}
