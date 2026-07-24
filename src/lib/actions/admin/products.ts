"use server";

import { revalidatePath } from "next/cache";
import { ProductBulletKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  AdminResult,
  asArray,
  formToObject,
  runAction,
} from "@/lib/admin/form";
import { productSchema, treatmentImageSchema } from "@/lib/admin/schemas";
import { fieldErrors } from "@/lib/validation";

const DUPLICATE = "That slug is already taken. Pick another.";
const MAX_IMAGES = 5;

function isUnique(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/* ------------------------------- Products ------------------------------- */

export async function saveProduct(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveProduct", async () => {
    const user = await requireAdminUser();

    const raw = formToObject(formData);
    raw.treatments = asArray(raw.treatments);

    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    // Resolve mapped treatments; the primary is either the named one or the
    // first in the list.
    const treatments = await prisma.treatment.findMany({
      where: { slug: { in: d.treatments } },
      select: { id: true, slug: true },
    });
    if (treatments.length === 0) {
      return {
        ok: false,
        error: "None of the selected treatments exist.",
        fields: { treatments: "Pick a valid treatment." },
      };
    }
    const primarySlug =
      d.primaryTreatment && d.treatments.includes(d.primaryTreatment)
        ? d.primaryTreatment
        : d.treatments[0];

    const images = d.images.slice(0, MAX_IMAGES);

    const data = {
      slug: d.slug,
      name: d.name,
      brand: d.brand || null,
      category: d.category,
      origin: d.origin || null,
      tagline: d.tagline || null,
      description: d.description || null,
      howItWorks: d.howItWorks || null,
      composition: d.composition || null,
      usageNotes: d.usageNotes || null,
      priceInr: d.priceInr ?? null,
      priceNote: d.priceNote || null,
      isPublished: d.isPublished,
      sortOrder: d.sortOrder,
    };

    const bulletRows = (productId: string) =>
      [
        [ProductBulletKind.FEATURE, d.features],
        [ProductBulletKind.BENEFIT, d.benefits],
        [ProductBulletKind.INDICATION, d.indications],
      ].flatMap(([kind, items]) =>
        (items as string[]).map((text, sortOrder) => ({
          productId,
          kind: kind as ProductBulletKind,
          text,
          sortOrder,
        }))
      );

    try {
      const before = id
        ? await prisma.product.findUnique({
            where: { id },
            include: { variants: true, bullets: true, images: true },
          })
        : null;

      const product = await prisma.$transaction(async (tx) => {
        const saved = id
          ? await tx.product.update({ where: { id }, data })
          : await tx.product.create({ data });

        // Child collections are positional/small — replace wholesale.
        await tx.productBullet.deleteMany({ where: { productId: saved.id } });
        const bullets = bulletRows(saved.id);
        if (bullets.length) await tx.productBullet.createMany({ data: bullets });

        await tx.productVariant.deleteMany({ where: { productId: saved.id } });
        const seen = new Set<string>();
        const variantRows = d.variants
          .filter((v) => (seen.has(v) ? false : (seen.add(v), true)))
          .map((label, sortOrder) => ({ productId: saved.id, label, sortOrder }));
        if (variantRows.length)
          await tx.productVariant.createMany({ data: variantRows });

        await tx.productImage.deleteMany({ where: { productId: saved.id } });
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((url, sortOrder) => ({
              productId: saved.id,
              url,
              sortOrder,
            })),
          });
        }

        await tx.treatmentProduct.deleteMany({ where: { productId: saved.id } });
        await tx.treatmentProduct.createMany({
          data: treatments.map((t, idx) => ({
            productId: saved.id,
            treatmentId: t.id,
            isPrimary: t.slug === primarySlug,
            sortOrder: idx,
          })),
        });

        return saved;
      });

      await audit({
        userId: user.id,
        action: id ? "update" : "create",
        entity: "Product",
        entityId: product.id,
        before,
        after: product,
      });

      revalidatePath("/admin/products");
      revalidatePath(`/products/${product.slug}`);
      if (before && before.slug !== product.slug) {
        revalidatePath(`/products/${before.slug}`);
      }
      // Treatment pages list their products.
      for (const t of treatments) revalidatePath(`/treatments/${t.slug}`);

      return { ok: true, id: product.id };
    } catch (err) {
      if (isUnique(err)) {
        return { ok: false, error: DUPLICATE, fields: { slug: DUPLICATE } };
      }
      throw err;
    }
  });
}

export async function deleteProduct(id: string): Promise<AdminResult> {
  return runAction("deleteProduct", async () => {
    const user = await requireAdminUser();

    const before = await prisma.product.findUnique({
      where: { id },
      include: { treatments: { include: { treatment: { select: { slug: true } } } } },
    });
    if (!before) return { ok: false, error: "Product not found." };

    await prisma.product.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Product",
      entityId: id,
      before,
    });

    revalidatePath("/admin/products");
    revalidatePath(`/products/${before.slug}`);
    for (const tp of before.treatments) {
      revalidatePath(`/treatments/${tp.treatment.slug}`);
    }
    return { ok: true };
  });
}

export async function setProductPublished(
  id: string,
  isPublished: boolean
): Promise<AdminResult> {
  return runAction("setProductPublished", async () => {
    const user = await requireAdminUser();
    const row = await prisma.product.update({
      where: { id },
      data: { isPublished },
      select: { id: true, slug: true },
    });
    await audit({
      userId: user.id,
      action: isPublished ? "publish" : "unpublish",
      entity: "Product",
      entityId: id,
      after: { isPublished },
    });
    revalidatePath("/admin/products");
    revalidatePath(`/products/${row.slug}`);
    return { ok: true };
  });
}

/* --------------------------- Treatment images --------------------------- */

export async function addTreatmentImage(
  treatmentId: string,
  formData: FormData
): Promise<AdminResult> {
  return runAction("addTreatmentImage", async () => {
    const user = await requireAdminUser();

    const parsed = treatmentImageSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the image fields.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    const treatment = await prisma.treatment.findUnique({
      where: { id: treatmentId },
      select: { slug: true },
    });
    if (!treatment) return { ok: false, error: "Treatment not found." };

    await prisma.treatmentImage.create({
      data: {
        treatmentId,
        kind: d.kind,
        url: d.url,
        caption: d.caption || null,
        sortOrder: d.sortOrder,
      },
    });
    await audit({
      userId: user.id,
      action: "create",
      entity: "TreatmentImage",
      entityId: treatmentId,
      after: { kind: d.kind, url: d.url },
    });

    revalidatePath(`/admin/treatments/${treatmentId}/images`);
    revalidatePath(`/treatments/${treatment.slug}`);
    return { ok: true };
  });
}

export async function deleteTreatmentImage(id: string): Promise<AdminResult> {
  return runAction("deleteTreatmentImage", async () => {
    const user = await requireAdminUser();
    const before = await prisma.treatmentImage.findUnique({
      where: { id },
      include: { treatment: { select: { id: true, slug: true } } },
    });
    if (!before) return { ok: false, error: "Image not found." };

    await prisma.treatmentImage.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "TreatmentImage",
      entityId: before.treatment.id,
      before: { kind: before.kind, url: before.url },
    });

    revalidatePath(`/admin/treatments/${before.treatment.id}/images`);
    revalidatePath(`/treatments/${before.treatment.slug}`);
    return { ok: true };
  });
}
