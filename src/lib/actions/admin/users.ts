"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import { AdminResult, runAction } from "@/lib/admin/form";

/**
 * Account administration. This is the lever that makes self-serve doctor
 * sign-ups safe: an admin can promote, demote or deactivate any account here.
 */

export async function setUserRole(
  id: string,
  role: string
): Promise<AdminResult> {
  return runAction("setUserRole", async () => {
    const admin = await requireAdminUser();

    const parsed = z.nativeEnum(Role).safeParse(role);
    if (!parsed.success) return { ok: false, error: "Unknown role." };

    // An admin can't strip their own admin rights — that would lock everyone
    // out if they're the last admin.
    if (id === admin.id && parsed.data !== Role.ADMIN) {
      return { ok: false, error: "You can't remove your own admin role." };
    }

    const before = await prisma.user.findUnique({
      where: { id },
      select: { role: true, email: true },
    });
    if (!before) return { ok: false, error: "User not found." };

    await prisma.user.update({ where: { id }, data: { role: parsed.data } });
    await audit({
      userId: admin.id,
      action: "update",
      entity: "User",
      entityId: id,
      before: { role: before.role },
      after: { role: parsed.data },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  });
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<AdminResult> {
  return runAction("setUserActive", async () => {
    const admin = await requireAdminUser();

    if (id === admin.id && !isActive) {
      return { ok: false, error: "You can't deactivate your own account." };
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) return { ok: false, error: "User not found." };

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isActive } }),
      // Deactivating kills active sessions so the change takes effect at once.
      ...(!isActive
        ? [prisma.session.deleteMany({ where: { userId: id } })]
        : []),
    ]);

    await audit({
      userId: admin.id,
      action: isActive ? "publish" : "unpublish",
      entity: "User",
      entityId: id,
      after: { isActive },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  });
}
