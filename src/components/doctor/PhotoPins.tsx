"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { addPhotoPin, removePhotoPin } from "@/lib/actions/photos";

/**
 * Tapping a point on a photograph and saying what would be done there.
 *
 * ── Why this is not part of the freehand markup ──────────────────────────
 * The strokes are a clinical reading: a circle round a lesion, kept beside
 * the image so the original is never altered, one layer per doctor. These
 * carry MONEY and go to the patient, which makes them a different object with
 * different care owed. Folding a price into the stroke JSON would put a
 * figure somebody acts on inside an unqueryable blob.
 *
 * ── The care taken with the number ───────────────────────────────────────
 * Every price on this screen says "indicative" and the total says it twice.
 * A figure pinned to a photograph of somebody's own face is read as a quote
 * whatever the small print says, and this platform has already deleted one
 * feature for implying a financial commitment it could not stand behind.
 * Leaving the price blank is a first-class answer and prints "on assessment"
 * — which is the honest one before anybody is in a chair.
 *
 * ── Coordinates are normalised ───────────────────────────────────────────
 * 0-1 of the image's width and height, exactly as the strokes are, so a pin
 * dropped on a phone in a treatment room lands in the same place on the
 * consulting-room monitor.
 */

export interface Pin {
  id: string;
  x: number;
  y: number;
  label: number;
  treatment: string;
  note: string | null;
  priceInr: number | null;
  sessions: number | null;
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const field =
  "w-full rounded-lg border border-graphite-200 bg-white px-2.5 py-1.5 text-sm text-graphite-900 outline-none focus:border-azure-400 focus:ring-2 focus:ring-azure-100";

export default function PhotoPins({
  photoId,
  src,
  pins,
}: {
  photoId: string;
  src: string;
  pins: Pin[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [placing, setPlacing] = useState<{ x: number; y: number } | null>(null);
  const [treatment, setTreatment] = useState("");
  const [price, setPrice] = useState("");
  const [sessions, setSessions] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.MouseEvent<HTMLDivElement>) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    // Clamped: a click on the very edge should land at the edge rather than
    // at 1.0001, which would put the pin outside the image on a re-render.
    const x = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - box.top) / box.height, 0), 1);
    setPlacing({ x, y });
    setError(null);
  }

  function save() {
    if (!placing) return;
    if (treatment.trim().length < 2) {
      setError("What would you do here?");
      return;
    }
    start(async () => {
      const res = await addPhotoPin({
        photoId,
        x: placing.x,
        y: placing.y,
        treatment,
        note,
        priceInr: price,
        sessions,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not add that.");
        return;
      }
      setPlacing(null);
      setTreatment("");
      setPrice("");
      setSessions("");
      setNote("");
    });
  }

  // Only the priced ones. A total that silently treats "on assessment" as
  // zero is a total that is wrong in the direction that flatters.
  const priced = pins.filter((p) => p.priceInr !== null);
  const total = priced.reduce(
    (n, p) => n + (p.priceInr ?? 0) * (p.sessions ?? 1),
    0
  );
  const unpriced = pins.length - priced.length;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-graphite-500">
        Tap a point on the photograph and say what you would do there. The
        patient sees these with the picture, so write them as you would say
        them.
      </p>

      <div
        ref={wrap}
        onClick={onPick}
        className="relative w-full cursor-crosshair overflow-hidden rounded-xl bg-graphite-900 ring-1 ring-graphite-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full select-none" draggable={false} />

        {pins.map((p) => (
          <span
            key={p.id}
            title={`${p.treatment}${p.priceInr !== null ? ` — ${money(p.priceInr)}` : ""}`}
            className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-azure-600 text-[11px] font-black text-white ring-2 ring-white"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            {p.label}
          </span>
        ))}

        {placing && (
          <span
            aria-hidden
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-mint-400 ring-2 ring-white"
            style={{ left: `${placing.x * 100}%`, top: `${placing.y * 100}%` }}
          />
        )}
      </div>

      {placing && (
        <div className="rounded-xl border-2 border-mint-300 bg-mint-50/50 p-3">
          <p className="mb-2 text-xs font-bold text-mint-900">
            What would you do at this point?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              autoFocus
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="Treatment — e.g. subcision + filler"
              className={`${field} sm:col-span-2`}
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder="Indicative price per session (₹)"
              className={field}
            />
            <input
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              inputMode="numeric"
              placeholder="Sessions"
              className={field}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the patient should know"
              className={`${field} sm:col-span-2`}
            />
          </div>
          {/* Said at the point of entry, not in a footnote. Leaving it blank
              is the right answer more often than it looks. */}
          <p className="mt-1.5 text-[11px] text-mint-800/80">
            Leave the price blank for &ldquo;on assessment&rdquo;. Whatever you
            put is shown to the patient as indicative, not as a quote.
          </p>

          {error && <p className="mt-1.5 text-xs text-coral-600">{error}</p>}

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-azure-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700 disabled:opacity-60"
            >
              {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Add this
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacing(null);
                setError(null);
              }}
              className="text-xs font-semibold text-graphite-500 hover:text-graphite-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pins.length > 0 && (
        <div className="rounded-xl border border-graphite-200">
          <ul className="divide-y divide-graphite-100">
            {pins.map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 px-3 py-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-azure-600 text-[10px] font-black text-white">
                  {p.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-graphite-900">
                    {p.treatment}
                  </p>
                  <p className="text-xs text-graphite-500">
                    {p.priceInr === null
                      ? "On assessment"
                      : `${money(p.priceInr)}${p.sessions ? ` × ${p.sessions} sessions` : " per session"}`}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <RemovePin id={p.id} />
              </li>
            ))}
          </ul>

          <div className="border-t border-graphite-200 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-graphite-500">
                Indicative total
              </span>
              <span className="font-display text-lg font-extrabold tabular-nums text-graphite-900">
                {priced.length === 0 ? "On assessment" : money(total)}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-graphite-500">
              {unpriced > 0 && (
                <>
                  {unpriced} of these {unpriced === 1 ? "is" : "are"} on
                  assessment and {unpriced === 1 ? "is" : "are"} not in the
                  figure.{" "}
                </>
              )}
              An estimate for planning, not a quote. What is actually charged
              depends on what is found on the day.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function RemovePin({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Remove this mark"
      disabled={pending}
      onClick={() => start(async () => void (await removePhotoPin(id)))}
      className="shrink-0 text-graphite-400 transition hover:text-coral-600 disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
