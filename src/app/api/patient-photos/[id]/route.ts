import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { createPresignedView, isConfigured, keyFromUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves one clinical photograph.
 *
 * These are pictures of somebody's skin, often their face, and they live in a
 * private prefix. There is no public path to one at any status: this route
 * asks who is looking on every request and signs a five-minute URL only for
 * the two parties entitled to see it.
 *
 *   1. The PATIENT it is of. Always. It is their body.
 *   2. A DOCTOR who has actually seen that patient, checked against the
 *      appointment table rather than assumed from a role.
 *
 * An admin is deliberately NOT on that list. Running the platform is not a
 * clinical relationship, and there is no operational task that requires
 * looking at a patient's photographs.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const photo = await prisma.patientPhoto.findUnique({
    where: { id: params.id },
    select: { url: true, storageKey: true, patientUserId: true },
  });
  if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let allowed = user.id === photo.patientUserId;

  if (!allowed && user.role === "DOCTOR") {
    const seen = await prisma.appointment.findFirst({
      where: { doctor: { userId: user.id }, patientUserId: photo.patientUserId },
      select: { id: true },
    });
    allowed = Boolean(seen);
  }

  // 404 rather than 403: whether a photograph of this person exists is itself
  // something only those two are entitled to know.
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const key = photo.storageKey || keyFromUrl(photo.url);
  if (!key) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const signed = await createPresignedView(key);
  // no-store: the redirect carries a credential, and a cached 307 would go on
  // resolving for whoever shares the browser next.
  return NextResponse.redirect(signed, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
