"use client";

/**
 * The one way this app uploads a file from the browser.
 *
 * ── Why one helper rather than seven copies ──────────────────────────────
 * The presigned-PUT dance was written out by hand in seven components — the
 * admin image field, the booking photo attach, the gallery composer, the
 * patient chart, the patient's own photos, the vendor form. Each copy handled
 * failure slightly differently and three of them swallowed the reason
 * entirely into "That upload did not go through", which is how a plain 403
 * from the authorisation check spent weeks looking like a network problem.
 *
 * ── The fallback is the point ────────────────────────────────────────────
 * A presigned PUT only works when the bucket's CORS configuration names the
 * exact origin the page is served from, port included. `next dev` moving to
 * :3003, a phone hitting the LAN address, a new deployment domain — each one
 * refuses the preflight, and a refused preflight makes `fetch` THROW before a
 * byte is sent. So a throw is not treated as fatal: the file is re-sent
 * through /api/uploads/direct, which enforces the same authorisation and the
 * same limits with the bytes passing through our server.
 *
 * Direct-to-S3 stays the default because it should be: an 8MB portrait has no
 * business travelling through Next when the browser can hand it to S3 itself.
 */

export interface UploadedFile {
  /** The stored URL. Private prefixes need /api/uploads/view to display. */
  url: string;
  /** The object key, for callers that persist it (patient photos do). */
  key: string;
  /** How it got there. Useful in a console when diagnosing a bucket. */
  via: "s3" | "server";
}

export type UploadResult =
  | { ok: true; file: UploadedFile }
  | { ok: false; error: string };

export interface UploadOptions {
  /** Bucket prefix. Authorised server-side against the caller's role. */
  folder: string;
  /**
   * Skip the presigned attempt. Set once a fallback has already succeeded in
   * this session, so the second and third file in a batch do not each pay for
   * a preflight that is already known to fail.
   */
  forceServer?: boolean;
}

/**
 * Set for the life of the page once a direct-to-S3 attempt has failed the way
 * a CORS refusal fails. Every later upload goes straight through the server
 * rather than re-discovering the same wall.
 */
let s3Unreachable = false;

/** Lets a caller show "uploads are going through the server" if it wants to. */
export function isS3Unreachable(): boolean {
  return s3Unreachable;
}

export async function uploadFile(
  file: File,
  options: UploadOptions | string
): Promise<UploadResult> {
  const opts: UploadOptions =
    typeof options === "string" ? { folder: options } : options;

  if (!opts.forceServer && !s3Unreachable) {
    const direct = await tryPresigned(file, opts.folder);
    // A refusal we can explain (too big, wrong type, not permitted) is the
    // answer, not something to retry a different way — the server route
    // enforces the identical rules and would only say the same thing slower.
    if (direct.kind === "ok") return { ok: true, file: direct.file };
    if (direct.kind === "refused") return { ok: false, error: direct.error };
    // direct.kind === "unreachable": S3 itself could not be spoken to.
    s3Unreachable = true;
  }

  return uploadViaServer(file, opts.folder);
}

type PresignOutcome =
  | { kind: "ok"; file: UploadedFile }
  | { kind: "refused"; error: string }
  | { kind: "unreachable" };

async function tryPresigned(
  file: File,
  folder: string
): Promise<PresignOutcome> {
  let presign: { uploadUrl: string; publicUrl: string; key: string };

  try {
    const res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        folder,
      }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, string>);

    if (!res.ok) {
      // 503 means S3 is not configured at all, which the server route cannot
      // fix either — but every other refusal is a real answer for the user.
      return { kind: "refused", error: body.error ?? "Upload failed." };
    }
    presign = body as typeof presign;
  } catch {
    // Our own API was unreachable, not S3. The fallback route lives on the
    // same server, so there is nothing to fall back to.
    return { kind: "refused", error: "Couldn't reach the server. Check your connection and try again." };
  }

  try {
    const put = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) {
      // A signature the bucket rejects is worth one retry through the server;
      // an expired link or a policy mismatch both land here.
      return { kind: "unreachable" };
    }
  } catch {
    // The refused-preflight case. This is the one this whole file exists for.
    return { kind: "unreachable" };
  }

  // Register the object so it appears in media_assets — and, for private
  // prefixes, so the uploader can view their own file back before the row
  // that references it exists. Best-effort: the file is already stored.
  await fetch("/api/uploads/presign", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: presign.key,
      url: presign.publicUrl,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  }).catch(() => undefined);

  return {
    kind: "ok",
    file: { url: presign.publicUrl, key: presign.key, via: "s3" },
  };
}

async function uploadViaServer(
  file: File,
  folder: string
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  try {
    const res = await fetch("/api/uploads/direct", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    if (!res.ok) {
      return { ok: false, error: body.error ?? "Upload failed." };
    }
    return {
      ok: true,
      file: { url: body.url, key: body.key, via: "server" },
    };
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Display URL for a stored file.
 *
 * Objects in a private prefix 403 in an `<img>`, so they have to be fetched
 * through the signing route. Matched on the path rather than the host so it
 * holds for both the S3 endpoint and a CDN domain. The server re-derives this
 * properly in lib/storage.ts — getting it wrong here only costs a broken
 * preview, never access, since /api/uploads/view authorises independently.
 */
export function displayUrl(url: string): string {
  if (!url) return url;
  return isPrivateUrl(url)
    ? `/api/uploads/view?url=${encodeURIComponent(url)}`
    : url;
}

export function isPrivateUrl(url: string): boolean {
  if (!url) return false;
  try {
    const p = new URL(url, "http://local").pathname.replace(/^\//, "");
    return ["credentials/", "prescriptions/", "patients/"].some((x) =>
      p.startsWith(x)
    );
  } catch {
    return false;
  }
}
