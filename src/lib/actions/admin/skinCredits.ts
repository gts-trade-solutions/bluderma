"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";

/**
 * Granting and revoking skin-analysis credits.
 *
 * Now that scans are priced, staff need a way to comp one — for a client who
 * cannot pay, to make up for a failed scan, or because someone at reception
 * promised it. Every grant is audited with a reason, because a free credit is
 * revenue given away and should be attributable.
 *
 * Only an unused credit can be revoked. A consumed one is a scan that already
 * happened, and pretending otherwise would put the ledger out of step with
 * the client's own analysis history.
 */

const grantSchema = z.object({
  userId: z.string().trim().min(1, "Pick a client."),
  count: z.coerce.number().int().min(1).max(20).default(1),
  reason: z.string().trim().min(1, "Say why this is being granted.").max(300),
});

export async function grantScanCredits(formData: FormData): Promise<AdminResult> {
  return runAction("grantScanCredits", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(grantSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const client = await prisma.user.findUnique({
      where: { id: d.userId },
      select: { id: true, email: true },
    });
    if (!client) return { ok: false, error: "That client no longer exists." };

    await prisma.skinEntitlement.createMany({
      data: Array.from({ length: d.count }, () => ({
        userId: client.id,
        state: "available",
        source: "granted",
      })),
    });

    await audit({
      userId: user.id,
      action: "create",
      entity: "SkinEntitlement",
      entityId: client.id,
      after: { granted: d.count, to: client.email, reason: d.reason },
    });

    revalidatePath("/admin/skin-credits");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}

export async function revokeScanCredit(id: string): Promise<AdminResult> {
  return runAction("revokeScanCredit", async () => {
    const user = await requireAdminUser();

    const before = await prisma.skinEntitlement.findUnique({
      where: { id },
      select: { id: true, state: true, source: true, userId: true },
    });
    if (!before) return { ok: false, error: "That credit no longer exists." };
    if (before.state !== "available") {
      return {
        ok: false,
        error: `Only an unused credit can be revoked — this one is ${before.state}.`,
      };
    }

    await prisma.skinEntitlement.update({
      where: { id },
      data: { state: "revoked", releasedAt: new Date() },
    });

    await audit({
      userId: user.id,
      action: "delete",
      entity: "SkinEntitlement",
      entityId: id,
      before,
    });

    revalidatePath("/admin/skin-credits");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}
