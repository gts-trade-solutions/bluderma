"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";

import { addOwnPhoto, deleteOwnPhoto } from "@/lib/actions/photos";

export interface MyPhoto {
  id: string;
  angle: string;
  capturedAt: string;
  byDoctor: boolean;
}

const ANGLES = ["FRONT", "LEFT", "RIGHT", "BACK", "TOP", "CLOSE_UP", "OTHER"] as const;
const LABEL: Record<string, string> = {
  FRONT: "Front",
  LEFT: "Left side",
  RIGHT: "Right side",
  BACK: "Back",
  TOP: "Top",
  CLOSE_UP: "Close-up",
  OTHER: "Other",
};

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * A client's own photographs.
 *
 * ── Why it asks which view before the camera opens ───────────────────────
 * A comparison between two photographs only means anything if they are the
 * same view. Left profile against front-on shows the camera moving, not the
 * skin changing, and a doctor cannot tell the difference after the fact. One
 * tap before the shutter is what makes the set worth keeping.
 *
 * ── What a client may remove ─────────────────────────────────────────────
 * Their own uploads, always. NOT the ones a doctor took in clinic: those are
 * part of a clinical record, and the practice's copy is not the patient's to
 * delete. The button says which is which rather than failing silently.
 */
export default function MyPhotos({ photos }: { photos: MyPhoto[] }) {
  const [angle, setAngle] = useState<string>("FRONT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That photo is over 8MB. Try a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          folder: "patients",
        }),
      });
      if (!presign.ok) throw new Error();
      const { uploadUrl, publicUrl, key } = await presign.json();
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error();

      const res = await addOwnPhoto({ angle, url: publicUrl, storageKey: key });
      if (!res.ok) setError(res.error ?? "Could not add that.");
    } catch {
      setError("That upload did not go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-muted">Which view</span>
        {ANGLES.slice(0, 4).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAngle(a)}
            aria-pressed={angle === a}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              angle === a
                ? "bg-white text-[#070d1c]"
                : "bg-white/[0.06] text-ink-soft ring-1 ring-inset ring-white/10"
            }`}
          >
            {LABEL[a]}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="btn-primary !py-2 text-sm disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Add a {LABEL[angle].toLowerCase()} photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="card-soft px-5 py-8 text-center">
          <Camera aria-hidden className="mx-auto h-6 w-6 text-ink-muted" strokeWidth={1.6} />
          <p className="mt-2.5 text-sm font-semibold text-ink">No photos yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
            Add the same views each time and your doctor can see what has
            actually changed. Only you and the doctors you book with can see
            these.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#0b1220] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/patient-photos/${p.id}`}
                  alt={`Your ${LABEL[p.angle]?.toLowerCase() ?? "skin"} photo`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] font-semibold text-white">
                  {LABEL[p.angle] ?? p.angle} · {p.capturedAt}
                </span>
                {p.byDoctor ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-400/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#04121f]">
                    Clinic
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Remove this photo"
                    disabled={pending}
                    onClick={() => start(async () => void (await deleteOwnPhoto(p.id)))}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white/70 opacity-0 transition hover:text-rose-300 group-hover:opacity-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Photos marked <span className="font-semibold text-teal-300">Clinic</span>{" "}
        were taken by your doctor and form part of your record, so they stay
        with the practice. Anything you added yourself you can remove.
      </p>
    </div>
  );
}
