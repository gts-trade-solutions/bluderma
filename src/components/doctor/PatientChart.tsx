"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

import {
  addClinicalPhoto,
  addPatientNote,
  deletePatientNote,
  sharePhotoPlan,
} from "@/lib/actions/photos";
import PhotoPins, { type Pin } from "@/components/doctor/PhotoPins";
import PhotoMarkupEditor, { type Stroke } from "./PhotoMarkup";
import { uploadFile } from "@/lib/uploadClient";
import { useFormValidation } from "@/hooks/useFormValidation";

export interface ChartPhoto {
  id: string;
  angle: string;
  capturedAt: string;
  note: string | null;
  byDoctor: boolean;
  strokes: Stroke[];
  markupNote: string;
  /** Treatments pinned to points on this photograph, with indicative prices. */
  pins: Pin[];
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
  const [tab, setTab] = useState<"draw" | "plan">("draw");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [angle, setAngle] = useState<string>("FRONT");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const formCheck = useFormValidation();

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That image is over 8MB.");
      return;
    }
    setUploading(true);

    // Private prefix, signed URLs only. Nothing here is ever public.
    const up = await uploadFile(file, "patients");
    if (!up.ok) {
      setUploading(false);
      setError(up.error);
      return;
    }

    const res = await addClinicalPhoto({
      patientUserId,
      angle,
      url: up.file.url,
      storageKey: up.file.key,
    });
    setUploading(false);
    if (!res.ok) setError(res.error ?? "Could not attach that.");
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
          <h3 className="text-sm font-extrabold text-graphite-900">Photographs</h3>
          <div className="flex items-center gap-2">
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              className="rounded-lg border border-graphite-200 px-2.5 py-1.5 text-xs font-semibold text-graphite-700 focus:border-azure-400 focus:outline-none"
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-graphite-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-graphite-700 disabled:opacity-60"
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

        {error && <p className="mb-2 text-xs font-semibold text-coral-600">{error}</p>}

        {photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-graphite-300 bg-graphite-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-graphite-600">
              No photographs yet
            </p>
            {/* The old copy said only what was missing. What a doctor needs to
                know is what the section is FOR — nobody discovered the markup
                tool because nothing said it existed. */}
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-graphite-500">
              Choose the view above, then take one. Anything the patient
              uploads themselves appears here too. Tap any photograph
              afterwards to draw on it, mark what you would treat and what it
              would cost, and send that to them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {byAngle.map((group) => (
              <div key={group.angle}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-graphite-500">
                  {ANGLE_LABEL[group.angle]} · {group.rows.length}
                </p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {group.rows.map((p) => (
                    <li key={p.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setMarking(p.id)}
                        className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-graphite-900 ring-1 ring-graphite-200"
                      >
                        <PhotoThumb id={p.id} />
                        {/* Two counts, because they are two different things:
                            marks are a reading, pins are a plan with money on
                            it. Shown always rather than on hover — a hover
                            state does not exist on the phone this is used on. */}
                        <span className="absolute right-1.5 top-1.5 flex gap-1">
                          {p.strokes.length > 0 && (
                            <span
                              title={`${p.strokes.length} marks`}
                              className="rounded-full bg-coral-500 px-1.5 py-0.5 text-[9px] font-black text-white"
                            >
                              {p.strokes.length}
                            </span>
                          )}
                          {p.pins.length > 0 && (
                            <span
                              title={`${p.pins.length} treatments`}
                              className="rounded-full bg-azure-600 px-1.5 py-0.5 text-[9px] font-black text-white"
                            >
                              {p.pins.length}
                            </span>
                          )}
                        </span>
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] font-semibold text-white">
                          {p.capturedAt}
                          <Pencil className="h-3 w-3 opacity-70" />
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-graphite-900/70 p-4">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-[10px] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-graphite-900">
                This photograph
              </h3>
              <button
                type="button"
                onClick={() => setMarking(null)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-graphite-500 transition hover:bg-graphite-100 hover:text-graphite-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Two jobs on one image, kept apart. Drawing is a clinical
                reading; pinning a treatment attaches a price and goes to the
                patient. Putting both in one canvas would make it impossible
                to tell which of a doctor's marks were an opinion and which
                were an offer. */}
            <div className="mb-3 flex gap-1 rounded-full bg-graphite-100 p-1">
              {(["draw", "plan"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    tab === t
                      ? "bg-white text-graphite-900 shadow-sm"
                      : "text-graphite-500 hover:text-graphite-800"
                  }`}
                >
                  {t === "draw" ? "Draw on it" : "What you would treat"}
                </button>
              ))}
            </div>

            {(() => {
              const p = photos.find((x) => x.id === marking);
              if (!p) return null;
              return tab === "draw" ? (
                <PhotoMarkupEditor
                  photoId={p.id}
                  src={`/api/patient-photos/${p.id}`}
                  initial={p.strokes}
                  initialNote={p.markupNote}
                />
              ) : (
                <PhotoPins
                  photoId={p.id}
                  src={`/api/patient-photos/${p.id}`}
                  pins={p.pins}
                />
              );
            })()}

            {/* Sharing is a separate, deliberate act. Everything above is
                working notes until this is pressed — see sharePhotoPlan. */}
            <ShareToPatient
              photoId={marking}
              hasSomething={
                (photos.find((x) => x.id === marking)?.strokes.length ?? 0) > 0 ||
                (photos.find((x) => x.id === marking)?.pins.length ?? 0) > 0
              }
            />
          </div>
        </div>
      )}

      {/* ── Chart notes ───────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-extrabold text-graphite-900">Your notes</h3>

        <form
          ref={formCheck.formRef}
          noValidate
          className="mb-3"
          onSubmit={formCheck.guard((fd, form) => {
            start(async () => {
              const res = await addPatientNote({
                patientUserId,
                body: String(fd.get("body") ?? ""),
              });
              if (!res.ok) setError(res.error ?? "Could not save that.");
              else form.reset();
            });
          })}
        >
          {formCheck.summary}
          <textarea
            name="body"
            rows={3}
            required
            placeholder="What you observed, what you did, what to watch."
            className="w-full rounded-xl border border-graphite-200 px-3.5 py-2.5 text-sm text-graphite-900 placeholder:text-graphite-500 focus:border-azure-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full bg-graphite-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-graphite-700 disabled:opacity-60"
          >
            {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Add to the chart
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-graphite-500">Nothing written yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-graphite-50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-graphite-700">
                    {n.body}
                  </p>
                  <button
                    type="button"
                    aria-label="Delete this note"
                    onClick={() => start(async () => void (await deletePatientNote(n.id)))}
                    className="shrink-0 text-graphite-400 transition hover:text-coral-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-graphite-500">{n.at}</p>
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

/**
 * "Send this to the patient."
 *
 * Deliberately at the foot of the modal rather than beside Save: saving a
 * mark and telling somebody about it are different decisions, and a doctor
 * sketching a second opinion over another practitioner's reading must not
 * publish it by pressing the only button on screen.
 */
function ShareToPatient({
  photoId,
  hasSomething,
}: {
  photoId: string;
  hasSomething: boolean;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 border-t border-graphite-100 pt-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !hasSomething || sent}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await sharePhotoPlan(photoId);
              if (res.ok) setSent(true);
              else setError(res.error ?? "Could not send that.");
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-graphite-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-graphite-700 disabled:opacity-50"
        >
          {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          {sent ? "Sent" : "Send this to the patient"}
        </button>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-graphite-500">
          {sent
            ? "They have been emailed a link. The photograph itself is not in the email."
            : hasSomething
              ? "They get a link to sign in and see it. Nothing on this page has reached them yet."
              : "Draw on it or add a treatment first."}
        </p>
      </div>
      {error && <p className="mt-1.5 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
