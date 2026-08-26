"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/uploadClient";

/**
 * Optional photographs of the concern, attached at booking.
 *
 * Dermatology is a visual speciality and a described rash is a poor substitute
 * for a seen one — a doctor who can look at the thing before the appointment
 * arrives already knows whether it needs a biopsy slot or five minutes.
 *
 * `capture` is deliberately NOT set on the input. Most of these are taken on a
 * phone, but forcing the camera would block the very common case of choosing a
 * photo taken last week when the flare was at its worst.
 *
 * These land in a private bucket prefix (`patients/`) and are readable only
 * through a signed URL — see /api/uploads/view. Nothing here is public.
 */

export interface AttachedPhoto {
  url: string;
  key: string;
  /** Local object URL for the thumbnail. Not persisted. */
  preview: string;
}

const MAX = 4;
const MAX_BYTES = 8 * 1024 * 1024;

export default function PhotoAttach({
  photos,
  onChange,
}: {
  photos: AttachedPhoto[];
  onChange: (next: AttachedPhoto[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<AttachedPhoto | null> {
    const res = await uploadFile(file, "patients");
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    return {
      url: res.file.url,
      key: res.file.key,
      preview: URL.createObjectURL(file),
    };
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;

    setError(null);
    const room = MAX - photos.length;
    if (room <= 0) return;

    const batch = picked.slice(0, room);
    if (picked.length > room) {
      setError(`You can attach up to ${MAX} photos.`);
    }

    const tooBig = batch.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      setError("Each photo must be under 8MB.");
    }
    const usable = batch.filter(
      (f) => f.size <= MAX_BYTES && f.type.startsWith("image/")
    );
    if (!usable.length) return;

    setBusy(usable.length);
    const done: AttachedPhoto[] = [];
    for (const f of usable) {
      const r = await uploadOne(f);
      if (r) done.push(r);
      setBusy((n) => n - 1);
    }
    if (done.length) onChange([...photos, ...done]);
    setBusy(0);
  }

  const full = photos.length >= MAX;

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <p className="text-sm font-bold text-ink">
        Photos of the area{" "}
        <span className="font-normal text-ink-muted">optional</span>
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        A clear, well-lit photo helps your doctor prepare before you arrive. Up
        to {MAX}. Only your doctor can see them.
      </p>

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.key} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt=""
                className="h-full w-full rounded-xl object-cover ring-1 ring-white/10"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((x) => x.key !== p.key))}
                // 32px hit area at the corner: small enough not to cover the
                // thumbnail, large enough to hit with a thumb.
                className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full on-dark bg-slate-900 text-sm font-bold text-white shadow-md"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={full || busy > 0}
        onClick={() => fileRef.current?.click()}
        className="mt-3 w-full rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm font-bold text-ink-soft transition hover:border-brand-400 hover:text-brand-200 disabled:opacity-50 sm:w-auto sm:px-5"
      >
        {busy > 0
          ? `Uploading ${busy}…`
          : full
            ? `Maximum ${MAX} photos`
            : photos.length
              ? "Add another photo"
              : "Add a photo"}
      </button>

      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
