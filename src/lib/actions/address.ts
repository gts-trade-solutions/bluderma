"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * A client's own saved places.
 *
 * These were DEMO_ADDRESSES: two invented Chennai addresses rendered on every
 * client's profile as though they were theirs. Two problems in one, because
 * they were also the last Indian street addresses on a site that has otherwise
 * been stripped of them.
 *
 * ── Ownership is checked on the ROW, never on the id ─────────────────────
 * Every mutation below scopes its `where` by `{ id, userId }` together. Taking
 * an id from a form and trusting it is how one client edits another's address:
 * ids are guessable enough, and cuid gives no authorisation. The unusual shape
 * of `updateMany`/`deleteMany` for what is logically a single row is precisely
 * so the userId can sit in the same filter, and a mismatch changes nothing
 * rather than throwing something a caller might mistake for a bad id.
 */

const addressSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, "Give it a name.").max(60),
  line1: z.string().trim().min(1, "The first line is needed.").max(160),
  line2: z.string().trim().max(160).optional().default(""),
  // Free text and optional. An address is not a schema, and insisting on a
  // shape the visitor's own country does not use is worse than taking what
  // they type. No pincode format is enforced for the same reason: this site is
  // meant to read the same in Seoul as in Chennai.
  city: z.string().trim().max(80).optional().default(""),
  pincode: z.string().trim().max(16).optional().default(""),
  phone: z.string().trim().max(24).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

const MAX_ADDRESSES = 8;

function revalidate() {
  revalidatePath("/patient/profile");
}

export async function saveAddress(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const data = {
    label: d.label,
    line1: d.line1,
    line2: d.line2 || null,
    city: d.city || null,
    pincode: d.pincode || null,
    phone: d.phone || null,
  };

  try {
    if (d.id) {
      // Scoped by userId as well as id: see the note above.
      const res = await prisma.patientAddress.updateMany({
        where: { id: d.id, userId: user.id },
        data,
      });
      if (res.count === 0) return { ok: false, error: "That address is not yours." };
      if (d.isDefault) await promote(user.id, d.id);
      revalidate();
      return { ok: true };
    }

    const count = await prisma.patientAddress.count({ where: { userId: user.id } });
    if (count >= MAX_ADDRESSES) {
      return {
        ok: false,
        error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`,
      };
    }

    const created = await prisma.patientAddress.create({
      data: { userId: user.id, ...data, isDefault: count === 0 || d.isDefault },
    });
    // The first address saved is the default whether or not the box was
    // ticked: a client with exactly one address and no default is a state
    // nothing downstream knows what to do with.
    if (count === 0 || d.isDefault) await promote(user.id, created.id);

    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save that. Please try again." };
  }
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  try {
    const row = await prisma.patientAddress.findFirst({
      where: { id, userId: user.id },
      select: { id: true, isDefault: true },
    });
    if (!row) return { ok: false, error: "That address is not yours." };

    await prisma.patientAddress.delete({ where: { id: row.id } });

    // Deleting the default leaves nothing marked, so the oldest survivor takes
    // over. Without this a client can end up with three addresses and no
    // default, which reads as a bug even though nothing failed.
    if (row.isDefault) {
      const next = await prisma.patientAddress.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await promote(user.id, next.id);
    }

    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove that. Please try again." };
  }
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const mine = await prisma.patientAddress.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!mine) return { ok: false, error: "That address is not yours." };

  await promote(user.id, id);
  revalidate();
  return { ok: true };
}

/**
 * Make one address the default and clear the rest, in one transaction.
 *
 * A partial unique index (`unique(userId) where isDefault`) is the tidy way to
 * express "exactly one" and MySQL does not have them, so the invariant lives
 * here instead. The transaction matters: clearing and setting as two separate
 * writes leaves a window with no default at all, and the profile page reads
 * that field.
 */
async function promote(userId: string, id: string): Promise<void> {
  await prisma.$transaction([
    prisma.patientAddress.updateMany({
      where: { userId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    }),
    prisma.patientAddress.updateMany({
      where: { id, userId },
      data: { isDefault: true },
    }),
  ]);
}
