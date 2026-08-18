import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Records who changed what. Admin content edits are otherwise invisible —
 * when a treatment's copy silently changes, this is the only way to answer
 * "who did that, and what did it say before?".
 */
export async function audit(input: {
  userId: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "publish"
    | "unpublish"
    | "reorder"
    /** Money returned to a client — its own verb, not an update. */
    | "refund";
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const h = headers();
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: (input.before ?? null) as Prisma.InputJsonValue,
        after: (input.after ?? null) as Prisma.InputJsonValue,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    // Never let an audit-write failure roll back or block the actual change.
    console.error("audit log failed", err);
  }
}
