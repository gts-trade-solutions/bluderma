"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import {
  addClinicalPhoto,
  addPatientNote,
  deletePatientNote,
} from "@/lib/actions/photos";
import PhotoMarkupEditor, { type Stroke } from "./PhotoMarkup";

export interface ChartPhoto {
  id: string;
  angle: string;
  capturedAt: string;
  note: string | null;
  byDoctor: boolean;
  strokes: Stroke[];
  markupNote: string;
}

export interface ChartNote {
  id: string;
  body: string;
  at: string;
}

const ANGLES = ["FRONT", "LEFT", "RIGHT", "BACK", "TOP", "CLOSE_UP", "OTHER"] as const;
const ANGLE_LABEL: Record<string, string> = {
  FRONT: "Front",
  LEFT: "Left",
  RIGHT: "Right",
  BACK: "Back",
  TOP: "Top",
  CLOSE_UP: "Close-up",
  OTHER: "Other",
};

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * One patient's photographs and chart notes.
 *
 * ── Photographs are grouped by angle, not by date ────────────────────────
 * A dermatology comparison only means anything between the same view. Sorting
 * a mixed pile by date puts a front shot next to a left profile and invites a
 * reader to see a change that is really the camera moving.
 *
 * Marks are drawn over the image and stored as coordinates; the photograph
 * itself is never rewritten. See PhotoMarkup for why that matters clinically.
 */
export default function PatientChart({
  patientUserId,
  photos,
  notes,
}: {
  patientUserId: string;
  photos: ChartPhoto[];
  notes: ChartNote[];
}) {
  const [marking, setMarking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [angle, setAngle] = useState<string>("FRONT");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That image is over 8MB.");
      return;
    }
    setUploading(true);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          // Private prefix, signed URLs only. Nothing here is ever public.
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

      const res = await addClinicalPhoto({
        patientUserId,
        angle,
        url: publicUrl,
        storageKey: key,
      });
      if (!res.ok) setError(res.error ?? "Could not attach that.");
    } catch {
      setError("That upload did not go through.");
    } finally {
      setUploading(false);
    }
  }

  const byAngle = ANGLES.map((a) => ({
    angle: a,
    rows: photos.filter((p) => p.angle === a),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      {/* ── Photographs ───────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900">Photographs</h3>
          <div className="flex items-center gap-2">
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-brand-400 focus:outline-none"
            >
              {ANGLES.map((a) => (
                <option key={a} value={a}>
                  {ANGLE_LABEL[a]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {uploading ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Take a photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {error && <p className="mb-2 text-xs font-semibold text-rose-600">{error}</p>}

        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No photographs yet. Choose the view first, then take one.
          </p>
        ) : (
          <div className="space-y-4">
            {byAngle.map((group) => (
              <div key={group.angle}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {ANGLE_LABEL[group.angle]} · {group.rows.length}
                </p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {group.rows.map((p) => (
                    <li key={p.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setMarking(p.id)}
                        className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200"
                      >
                        <PhotoThumb id={p.id} />
                        {p.strokes.length > 0 && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                            {p.strokes.length}
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] font-semibold text-white">
                          {p.capturedAt}
                          <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── The markup editor, over the chosen photograph ──────────── */}
      {marking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/70 p-4">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Mark the photograph
              </h3>
              <button
                type="button"
                onClick={() => setMarking(null)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {(() => {
              const p = photos.find((x) => x.id === marking);
              if (!p) return null;
              return (
                <PhotoMarkupEditor
                  photoId={p.id}
                  src={`/api/patient-photos/${p.id}`}
                  initial={p.strokes}
                  initialNote={p.markupNote}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Chart notes ───────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-extrabold text-slate-900">Your notes</h3>

        <form
          className="mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            start(async () => {
              const res = await addPatientNote({
                patientUserId,
                body: String(fd.get("body") ?? ""),
              });
              if (!res.ok) setError(res.error ?? "Could not save that.");
              else form.reset();
            });
          }}
        >
          <textarea
            name="body"
            rows={3}
            required
            placeholder="What you observed, what you did, what to watch."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Add to the chart
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing written yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-slate-50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {n.body}
                  </p>
                  <button
                    type="button"
                    aria-label="Delete this note"
                    onClick={() => start(async () => void (await deletePatientNote(n.id)))}
                    className="shrink-0 text-slate-300 transition hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{n.at}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The image itself, through the signing route. */
function PhotoThumb({ id }: { id: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/patient-photos/${id}`}
      alt="Clinical photograph"
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}
