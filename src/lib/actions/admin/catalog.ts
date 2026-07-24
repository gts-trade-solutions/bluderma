"use server";

import { revalidatePath } from "next/cache";
import { BulletKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  AdminResult,
  parseForm,
  revalidateContent,
  runAction,
} from "@/lib/admin/form";
import { categorySchema, treatmentSchema } from "@/lib/admin/schemas";

const DUPLICATE_SLUG = "That slug is already taken. Pick another.";

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/* ------------------------------ Categories ------------------------------ */

export async function saveCategory(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveCategory", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(categorySchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      slug: d.slug,
      name: d.name,
      blurb: d.blurb || null,
      image: d.image,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    };

    try {
      const before = id
        ? await prisma.category.findUnique({ where: { id } })
        : null;

      const row = id
        ? await prisma.category.update({ where: { id }, data })
        : await prisma.category.create({ data });

      await audit({
        userId: user.id,
        action: id ? "update" : "create",
        entity: "Category",
        entityId: row.id,
        before,
        after: row,
      });

      revalidateContent();
      revalidatePath("/admin/categories");
      return { ok: true, id: row.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { ok: false, error: DUPLICATE_SLUG, fields: { slug: DUPLICATE_SLUG } };
      }
      throw err;
    }
  });
}

export async function deleteCategory(id: string): Promise<AdminResult> {
  return runAction("deleteCategory", async () => {
    const user = await requireAdminUser();

    // Treatments reference categories with a required FK, so deleting one out
    // from under them would fail at the database. Say so plainly instead.
    const count = await prisma.treatment.count({ where: { categoryId: id } });
    if (count > 0) {
      return {
        ok: false,
        error: `This category still has ${count} treatment${
          count === 1 ? "" : "s"
        }. Move or delete them first.`,
      };
    }

    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Category not found." };

    await prisma.category.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Category",
      entityId: id,
      before,
    });

    revalidateContent();
    revalidatePath("/admin/categories");
    return { ok: true };
  });
}

/* ------------------------------ Treatments ------------------------------ */

export async function saveTreatment(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveTreatment", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(treatmentSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const data = {
      slug: d.slug,
      name: d.name,
      categoryId: d.categoryId,
      tagline: d.tagline,
      image: d.image,
      summary: d.summary,
      concern: d.concern,
      howItWorks: d.howItWorks,
      clinicalNote: d.clinicalNote,
      factSessions: d.factSessions,
      factDowntime: d.factDowntime,
      factResults: d.factResults,
      factDuration: d.factDuration,
      productName: d.productName,
      productDescriptor: d.productDescriptor,
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      sortOrder: d.sortOrder,
      isPublished: d.isPublished,
    };

    const bulletRows = (treatmentId: string) =>
      [
        [BulletKind.CONCERN_POINT, d.concernPoints],
        [BulletKind.PROCEDURE_STEP, d.procedureSteps],
        [BulletKind.BENEFIT, d.benefits],
        [BulletKind.IDEAL_FOR, d.idealFor],
      ].flatMap(([kind, items]) =>
        (items as string[]).map((text, sortOrder) => ({
          treatmentId,
          kind: kind as BulletKind,
          text,
          sortOrder,
        }))
      );

    try {
      const before = id
        ? await prisma.treatment.findUnique({
            where: { id },
            include: { bullets: true },
          })
        : null;

      // Bullets are positional; rewriting them wholesale inside a transaction
      // avoids a partial state where a save half-applied.
      const row = await prisma.$transaction(async (tx) => {
        const saved = id
          ? await tx.treatment.update({ where: { id }, data })
          : await tx.treatment.create({ data });

        await tx.treatmentBullet.deleteMany({ where: { treatmentId: saved.id } });
        const rows = bulletRows(saved.id);
        if (rows.length) await tx.treatmentBullet.createMany({ data: rows });

        return saved;
      });

      await audit({
        userId: user.id,
        action: id ? "update" : "create",
        entity: "Treatment",
        entityId: row.id,
        before,
        after: row,
      });

      revalidateContent([`/treatments/${row.slug}`]);
      if (before && before.slug !== row.slug) {
        revalidatePath(`/treatments/${before.slug}`);
      }
      revalidatePath("/admin/treatments");
      return { ok: true, id: row.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { ok: false, error: DUPLICATE_SLUG, fields: { slug: DUPLICATE_SLUG } };
      }
      throw err;
    }
  });
}

export async function deleteTreatment(id: string): Promise<AdminResult> {
  return runAction("deleteTreatment", async () => {
    const user = await requireAdminUser();

    const before = await prisma.treatment.findUnique({
      where: { id },
      include: { bullets: true },
    });
    if (!before) return { ok: false, error: "Treatment not found." };

    // Enquiries keep their productName snapshot and null out the FK, so
    // deleting a treatment never destroys a lead.
    await prisma.treatment.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Treatment",
      entityId: id,
      before,
    });

    revalidateContent([`/treatments/${before.slug}`]);
    revalidatePath("/admin/treatments");
    return { ok: true };
  });
}

export async function setTreatmentPublished(
  id: string,
  isPublished: boolean
): Promise<AdminResult> {
  return runAction("setTreatmentPublished", async () => {
    const user = await requireAdminUser();

    const row = await prisma.treatment.update({
      where: { id },
      data: { isPublished },
      select: { id: true, slug: true, isPublished: true },
    });

    await audit({
      userId: user.id,
      action: isPublished ? "publish" : "unpublish",
      entity: "Treatment",
      entityId: id,
      after: row,
    });

    revalidateContent([`/treatments/${row.slug}`]);
    revalidatePath("/admin/treatments");
    return { ok: true };
  });
}
