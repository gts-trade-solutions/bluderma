"use server";

import { revalidatePath } from "next/cache";
import { SettingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  AdminResult,
  formToObject,
  parseForm,
  revalidateContent,
  runAction,
} from "@/lib/admin/form";
import { bannerSchema, faqSchema, testimonialSchema } from "@/lib/admin/schemas";

/* ----------------------------- Testimonials ----------------------------- */

export async function saveTestimonial(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveTestimonial", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(testimonialSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      authorName: d.authorName,
      authorRole: d.authorRole || null,
      avatarUrl: d.avatarUrl,
      quote: d.quote,
      rating: d.rating ?? null,
      treatmentId: d.treatmentId || null,
      isPublished: d.isPublished,
      sortOrder: d.sortOrder,
    };

    const before = id
      ? await prisma.testimonial.findUnique({ where: { id } })
      : null;
    const row = id
      ? await prisma.testimonial.update({ where: { id }, data })
      : await prisma.testimonial.create({ data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "Testimonial",
      entityId: row.id,
      before,
      after: row,
    });

    revalidateContent();
    revalidatePath("/admin/testimonials");
    return { ok: true, id: row.id };
  });
}

export async function deleteTestimonial(id: string): Promise<AdminResult> {
  return runAction("deleteTestimonial", async () => {
    const user = await requireAdminUser();
    const before = await prisma.testimonial.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Testimonial not found." };

    await prisma.testimonial.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Testimonial",
      entityId: id,
      before,
    });

    revalidateContent();
    revalidatePath("/admin/testimonials");
    return { ok: true };
  });
}

/* --------------------------------- FAQs --------------------------------- */

export async function saveFaq(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveFaq", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(faqSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      question: d.question,
      answer: d.answer,
      category: d.category || null,
      isPublished: d.isPublished,
      sortOrder: d.sortOrder,
    };

    const before = id ? await prisma.faq.findUnique({ where: { id } }) : null;
    const row = id
      ? await prisma.faq.update({ where: { id }, data })
      : await prisma.faq.create({ data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "Faq",
      entityId: row.id,
      before,
      after: row,
    });

    revalidateContent();
    revalidatePath("/admin/faqs");
    return { ok: true, id: row.id };
  });
}

export async function deleteFaq(id: string): Promise<AdminResult> {
  return runAction("deleteFaq", async () => {
    const user = await requireAdminUser();
    const before = await prisma.faq.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "FAQ not found." };

    await prisma.faq.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Faq",
      entityId: id,
      before,
    });

    revalidateContent();
    revalidatePath("/admin/faqs");
    return { ok: true };
  });
}

/* ------------------------------- Banners -------------------------------- */

export async function saveBanner(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveBanner", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(bannerSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      placement: d.placement,
      title: d.title || null,
      subtitle: d.subtitle || null,
      ctaLabel: d.ctaLabel || null,
      ctaHref: d.ctaHref || null,
      mediaType: d.mediaType,
      mediaUrl: d.mediaUrl,
      posterUrl: d.posterUrl,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    };

    const before = id ? await prisma.banner.findUnique({ where: { id } }) : null;
    const row = id
      ? await prisma.banner.update({ where: { id }, data })
      : await prisma.banner.create({ data });

    await audit({
      userId: user.id,
      action: id ? "update" : "create",
      entity: "Banner",
      entityId: row.id,
      before,
      after: row,
    });

    revalidateContent();
    revalidatePath("/admin/banners");
    return { ok: true, id: row.id };
  });
}

export async function deleteBanner(id: string): Promise<AdminResult> {
  return runAction("deleteBanner", async () => {
    const user = await requireAdminUser();
    const before = await prisma.banner.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Banner not found." };

    await prisma.banner.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Banner",
      entityId: id,
      before,
    });

    revalidateContent();
    revalidatePath("/admin/banners");
    return { ok: true };
  });
}

/* ------------------------------- Settings ------------------------------- */

/**
 * Saves the whole settings form at once. Only keys that already exist are
 * written — the form is generated from the current rows, so an unexpected key
 * means a crafted request rather than a legitimate edit.
 */
export async function saveSettings(formData: FormData): Promise<AdminResult> {
  return runAction("saveSettings", async () => {
    const user = await requireAdminUser();

    const submitted = formToObject(formData);
    const existing = await prisma.siteSetting.findMany();
    const known = new Map(existing.map((s) => [s.key, s]));

    const changes: { key: string; from: string | null; to: string }[] = [];

    for (const [key, raw] of Object.entries(submitted)) {
      const current = known.get(key);
      if (!current) continue;

      const value =
        current.type === SettingType.BOOLEAN
          ? raw === "on" || raw === "true"
            ? "true"
            : "false"
          : String(raw ?? "");

      if (value !== (current.value ?? "")) {
        changes.push({ key, from: current.value, to: value });
      }
    }

    // Booleans that were unticked don't appear in FormData at all.
    for (const s of existing) {
      if (s.type !== SettingType.BOOLEAN) continue;
      if (Object.prototype.hasOwnProperty.call(submitted, s.key)) continue;
      if ((s.value ?? "") !== "false") {
        changes.push({ key: s.key, from: s.value, to: "false" });
      }
    }

    if (changes.length === 0) return { ok: true };

    await prisma.$transaction(
      changes.map((c) =>
        prisma.siteSetting.update({
          where: { key: c.key },
          data: { value: c.to },
        })
      )
    );

    await audit({
      userId: user.id,
      action: "update",
      entity: "SiteSetting",
      before: Object.fromEntries(changes.map((c) => [c.key, c.from])),
      after: Object.fromEntries(changes.map((c) => [c.key, c.to])),
    });

    revalidateContent();
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}
