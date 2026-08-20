"use client";

import { useId, useRef, useState } from "react";

import { useFieldError } from "./formContext";

/**
 * URL input with an optional direct-to-S3 upload.
 *
 * The URL is the source of truth: all seeded content points at remote CDN
 * images, and uploads are additive. If S3 isn't configured the upload button
 * explains why and the field still works by pasting a URL — so the admin is
 * fully usable before any AWS setup.
 */
export default function ImageField({
  label,
  name,
  defaultValue,
  required,
  folder = "uploads",
  accept = "image/*",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  folder?: string;
  accept?: string;
  hint?: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const error = useFieldError(name);

  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  // Certificates and prescriptions live in bucket prefixes that are not
  // publicly readable, so the stored URL 403s in an <img>. The signed-view
  // route is the only way to show the doctor the file they just uploaded.
  const previewSrc = isPrivateUrl(url)
    ? `/api/uploads/view?url=${encodeURIComponent(url)}`
    : url;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setUploadError(null);

    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder,
        }),
      });

      const presign = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        setUploadError(presign.error ?? "Upload failed.");
        return;
      }

      // A CORS preflight refusal makes this THROW rather than return a
      // response, so it has to be caught here to be told apart from a genuine
      // network drop — otherwise both surface as "upload failed" and the
      // bucket configuration never gets suspected.
      let put: Response;
      try {
        put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      } catch {
        setUploadError(
          "Storage refused the upload from this site. The bucket needs a CORS rule for this domain — run: npx tsx prisma/setup-s3.ts"
        );
        return;
      }
      if (!put.ok) {
        setUploadError(
          put.status === 403
            ? "Storage rejected the upload (403). The signed link may have expired — try again."
            : `Storage rejected the upload (${put.status}).`
        );
        return;
      }

      // Register the object so it shows up in media_assets.
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

      setUrl(presign.publicUrl);
      setBroken(false);
    } catch {
      // Everything S3-side is handled above, so reaching here means our own
      // API was unreachable.
      setUploadError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Preview — remote URLs are fragile, so failures show a label. */}
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {url && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
              onLoad={() => setBroken(false)}
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-muted">
              {broken ? "Can't load image" : "No image"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            id={id}
            name={name}
            value={url}
            required={required}
            onChange={(e) => {
              setUrl(e.target.value);
              setBroken(false);
            }}
            placeholder="https://… or upload a file"
            aria-invalid={error ? true : undefined}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
              error ? "border-rose-300" : "border-slate-200"
            }`}
          />

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
            >
              {busy ? "Uploading…" : "Upload file"}
            </button>
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="text-xs font-semibold text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>

          {uploadError && (
            <p className="mt-2 text-xs text-amber-700">{uploadError}</p>
          )}
          {error ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
          ) : hint ? (
            <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}

/**
 * Is this one of ours, in a prefix the bucket keeps private?
 *
 * Matched on the path rather than the host so it holds for both the S3
 * endpoint and a CDN domain. The server re-derives this properly in
 * lib/storage.ts — getting it wrong here only costs a broken preview, never
 * access, since the route authorises independently.
 */
function isPrivateUrl(url: string): boolean {
  if (!url) return false;
  try {
    const p = new URL(url, "http://local").pathname.replace(/^\//, "");
    return ["credentials/", "prescriptions/"].some((x) => p.startsWith(x));
  } catch {
    return false;
  }
}
