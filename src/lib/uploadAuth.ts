import "server-only";

import { getCurrentUser } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * Who may write to which bucket prefix.
 *
 * Lifted out of /api/uploads/presign so the direct-upload fallback route
 * enforces exactly the same rule. Two routes that both hand out write access
 * to the bucket must not be able to drift apart — the moment one of them
 * decides `treatments/` is fine for a doctor, the catalogue imagery for the
 * whole site is writable by anyone with a practitioner login.
 */

/**
 * The only folders a doctor may write to.
 *
 * Presigned URLs grant real write access to the bucket, and this used to be
 * admin-only for that reason. Doctors upload their own portrait, registration
 * document and clinic photographs during onboarding, so they need it — but
 * scoped. The key is built from the folder plus random bytes (see buildKey),
 * so within an allowed folder they can only ever create, never clobber.
 */
export const DOCTOR_FOLDERS = new Set([
  "doctors",
  "clinics",
  "cases",
  "credentials",
  // Clinical photographs of their own patients. A private prefix.
  "patients",
]);

/**
 * The only folder a patient may write to: photographs they attach to their own
 * booking, and their own progress pictures. A private prefix, so nothing
 * uploaded here is readable without a signed URL — see /api/uploads/view.
 */
export const PATIENT_FOLDERS = new Set(["patients"]);

/**
 * The one prefix an anonymous visitor may write to.
 *
 * /sell is a public form — a pharmacy applies to supply the platform without
 * an account, and the schema accepts that submission anonymously. Its drug
 * licence had nowhere to go: it was being written to `credentials/`, which
 * only a DOCTOR may touch, so every vendor licence upload 403'd. The form's
 * own copy ("you can submit without it") hid that for as long as it lasted.
 *
 * A separate prefix rather than widening `credentials/`, because that one
 * holds practitioners' registration certificates and must not become writable
 * by the public. Private, signed access only, and rate limited by IP below.
 */
export const PUBLIC_FOLDERS = new Set(["vendor-licences"]);

/** How many files one anonymous IP may upload in an hour. */
const ANON_LIMIT = 6;
const ANON_WINDOW_MS = 60 * 60_000;

export type UploadAuth =
  | { ok: true; userId: string | null }
  | { ok: false; status: number; error: string };

/**
 * Admins upload anywhere. Doctors and patients upload to their own folders.
 *
 * Deliberately keyed on the ROLE rather than on having an approved Doctor row:
 * the uploads happen during onboarding, before there is anything to approve.
 */
export async function authorizeUpload(
  folder: string,
  /** Passed by the routes so an anonymous upload can be rate limited by IP. */
  req?: Request
): Promise<UploadAuth> {
  const user = await getCurrentUser();

  if (!user) {
    if (!PUBLIC_FOLDERS.has(folder) || !req) {
      return { ok: false, status: 403, error: "Not permitted." };
    }
    const limit = rateLimit(
      `upload:anon:${clientIp(req)}`,
      ANON_LIMIT,
      ANON_WINDOW_MS
    );
    if (!limit.ok) {
      return {
        ok: false,
        status: 429,
        error: "Too many uploads from this connection. Try again later.",
      };
    }
    // Nothing to attribute the media asset to. The caller stores null.
    return { ok: true, userId: null };
  }

  // A signed-in visitor may use the public prefix too — same form, they just
  // happen to have an account.
  if (PUBLIC_FOLDERS.has(folder)) return { ok: true, userId: user.id };
  if (user.role === "ADMIN") return { ok: true, userId: user.id };
  if (user.role === "DOCTOR" && DOCTOR_FOLDERS.has(folder)) {
    return { ok: true, userId: user.id };
  }
  if (user.role === "PATIENT" && PATIENT_FOLDERS.has(folder)) {
    return { ok: true, userId: user.id };
  }
  return { ok: false, status: 403, error: "Not permitted." };
}
