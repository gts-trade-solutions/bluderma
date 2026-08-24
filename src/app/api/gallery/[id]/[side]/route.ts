import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isViewable } from "@/lib/gallery/viewable";
import { getCurrentUser } from "@/lib/session";
import { createPresignedView, isConfigured, keyFromUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves one image of a before-and-after case.
 *
 * ── Why these are not public objects ─────────────────────────────────────
 * They are photographs of a patient's face, shown under a consent that can be
 * withdrawn. A public object cannot be un-shown: anybody who kept the URL
 * keeps the picture, and "you can change your mind" becomes a promise the
 * storage layer quietly breaks.
 *
 * So the objects live in a private prefix and this route re-asks the question
 * on every request. Withdraw consent and the very next load stops resolving.
 * That is the difference between a policy and a mechanism.
 *
 * ── Three ways to be allowed, and only three ─────────────────────────────
 *   1. The case is published and consent stands. Anyone, including anonymous
 *      visitors, because a public gallery is public.
 *   2. The PATIENT the case is of. They have to see the actual pair to decide
 *      whether to agree to it — consent to "photographs from your treatment"
 *      is not consent to two particular pictures of your own face.
 *   3. The DOCTOR who owns it, to check what they uploaded.
 *
 * Nobody else, at any status.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string; side: string } }
) {
  if (params.side !== "before" && params.side !== "after") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const row = await prisma.doctorGalleryCase.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      consentGivenAt: true,
      consentWithdrawnAt: true,
      patientUserId: true,
      beforeUrl: true,
      beforeKey: true,
      afterUrl: true,
      afterKey: true,
      doctor: { select: { userId: true } },
    },
  });
  // 404 rather than 403 for a case that exists but is not viewable: whether a
  // withdrawn case ever existed is itself the patient's business.
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let allowed = isViewable(row);
  if (!allowed) {
    // Only ask who is asking when the public answer was no. A published case
    // must not need a session to load.
    const user = await getCurrentUser();
    allowed =
      Boolean(user) &&
      (user!.id === row.patientUserId || user!.id === row.doctor.userId);
  }
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const stored = params.side === "before" ? row.beforeKey : row.afterKey;
  const url = params.side === "before" ? row.beforeUrl : row.afterUrl;
  const key = stored || keyFromUrl(url);
  if (!key) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const signed = await createPresignedView(key);
  // no-store: the redirect carries a credential, and a cached 307 would go on
  // resolving after consent is withdrawn, which is the whole thing this route
  // exists to prevent.
  return NextResponse.redirect(signed, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
