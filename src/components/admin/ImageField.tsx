"use client";

import { useId, useRef, useState } from "react";

import { displayUrl, uploadFile } from "@/lib/uploadClient";
import { useFieldError } from "./formContext";

/**
 * URL input with an optional upload.
 *
 * The URL is the source of truth: all seeded content points at remote CDN
 * images, and uploads are additive. If S3 isn't configured the upload button
 * explains why and the field still works by pasting a URL — so the admin is
 * fully usable before any AWS setup.
 *
 * The upload itself is lib/uploadClient.ts, shared with every other place in
 * the app that takes a file. It tries the browser-to-S3 path and falls back
 * through our own server when the bucket will not talk to this origin.
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

  // Certificates, prescriptions and patient photographs live in bucket
  // prefixes that are not publicly readable, so the stored URL 403s in an
  // <img>. The signed-view route is the only way to show the doctor the file
  // they just uploaded.
  const previewSrc = displayUrl(url);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setUploadError(null);

    const res = await uploadFile(file, folder);
    setBusy(false);

    if (!res.ok) {
      setUploadError(res.error);
      return;
    }
    setUrl(res.file.url);
    setBroken(false);
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
