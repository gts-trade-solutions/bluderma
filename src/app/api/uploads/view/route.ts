import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  createPresignedView,
  isConfigured,
  isPrivateKey,
  keyFromUrl,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Opens a private stored object behind a short-lived signed URL.
 *
 * Registration certificates and prescriptions live in bucket prefixes that are
 * deliberately not publicly readable — the onboarding form promises the
 * certificate goes "to our review team and nowhere else", and a public prefix
 * would make that untrue. The admin review screen therefore cannot link
 * straight at the stored URL; it links here, and gets redirected to a URL that
 * stops working in five minutes.
 *
 * Authorisation is per-object, not merely per-role:
 *   - ADMIN may view any private object (they run the review queue).
 *   - A DOCTOR may view their OWN certificate, their own prescriptions, and
 *     photographs attached to THEIR OWN appointments.
 *   - A PATIENT may view what they uploaded and what is attached to their own
 *     appointment.
 *   - Nobody else gets anything.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  // Refusing anything we cannot resolve to a key in OUR bucket is what stops
  // this endpoint being pointed at an arbitrary URL.
  const key = keyFromUrl(raw);
  if (!key) {
    return NextResponse.json({ error: "Not a stored file." }, { status: 400 });
  }

  // A public object needs no signature, and signing one here would only make
  // an expiring copy of a URL that already works.
  if (!isPrivateKey(key)) {
    return NextResponse.redirect(raw);
  }

  if (user.role !== "ADMIN") {
    const owned = await ownsPrivateObject(user.id, raw, key);
    if (!owned) {
      return NextResponse.json({ error: "Not permitted." }, { status: 403 });
    }
  }

  const signed = await createPresignedView(key);
  // no-store: the redirect embeds a credential, and a cached 307 would hand it
  // to whoever shares the browser next.
  return NextResponse.redirect(signed, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Does this non-admin user own the private object they are asking for?
 *
 * Checked against the row that references the URL rather than against the key
 * shape, because a key carries no owner — only the database knows whose
 * certificate this is.
 */
async function ownsPrivateObject(
  userId: string,
  url: string,
  key: string
): Promise<boolean> {
  // Uploading it is itself proof of ownership, and it is the only proof
  // available between the upload finishing and the form being saved — during
  // which the doctor is looking at a preview of their own certificate.
  const uploaded = await prisma.mediaAsset.findFirst({
    where: { storageKey: key, uploadedById: userId },
    select: { id: true },
  });
  if (uploaded) return true;

  const prefix = key.split("/")[0];

  if (prefix === "credentials") {
    const mine = await prisma.doctor.findFirst({
      where: { userId, licenceDocUrl: url },
      select: { id: true },
    });
    return Boolean(mine);
  }

  if (prefix === "patients") {
    // A booking photograph. Readable by the patient who attached it (covered
    // by the uploader check above) and by the doctor whose appointment it is
    // — nobody else, including other doctors.
    const mine = await prisma.appointmentPhoto.findFirst({
      where: {
        url,
        OR: [
          { appointment: { doctor: { userId } } },
          { appointment: { patientUserId: userId } },
        ],
      },
      select: { id: true },
    });
    return Boolean(mine);
  }

  if (prefix === "prescriptions") {
    // Readable by the patient it was written for, or by the doctor who wrote
    // it — nobody else, including other doctors.
    const mine = await prisma.prescription.findFirst({
      where: {
        fileUrl: url,
        OR: [{ userId }, { doctor: { userId } }],
      },
      select: { id: true },
    });
    return Boolean(mine);
  }

  return false;
}
