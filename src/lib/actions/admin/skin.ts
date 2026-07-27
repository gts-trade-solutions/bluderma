"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import { AdminResult, runAction } from "@/lib/admin/form";

/** Approve a "request another scan" — grants the user one extra scan. */
export async function approveSkinRequest(id: string): Promise<AdminResult> {
  return runAction("approveSkinRequest", async () => {
    const admin = await requireAdminUser();

    const reqRow = await prisma.skinAccessRequest.findUnique({ where: { id } });
    if (!reqRow) return { ok: false, error: "Request not found." };
    if (reqRow.status !== "pending") {
      return { ok: false, error: "This request was already handled." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.skinAccessRequest.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      await tx.skinEntitlement.create({
        data: { userId: reqRow.userId, state: "available", source: "granted" },
      });
    });

    await audit({
      userId: admin.id,
      action: "update",
      entity: "SkinAccessRequest",
      entityId: id,
      after: { status: "approved", grantedTo: reqRow.userId },
    });

    revalidatePath("/admin/skin-requests");
    return { ok: true };
  });
}

/** Decline a scan request without granting anything. */
export async function rejectSkinRequest(id: string): Promise<AdminResult> {
  return runAction("rejectSkinRequest", async () => {
    const admin = await requireAdminUser();

    const reqRow = await prisma.skinAccessRequest.findUnique({ where: { id } });
    if (!reqRow) return { ok: false, error: "Request not found." };
    if (reqRow.status !== "pending") {
      return { ok: false, error: "This request was already handled." };
    }

    await prisma.skinAccessRequest.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    await audit({
      userId: admin.id,
      action: "update",
      entity: "SkinAccessRequest",
      entityId: id,
      after: { status: "rejected" },
    });

    revalidatePath("/admin/skin-requests");
    return { ok: true };
  });
}
