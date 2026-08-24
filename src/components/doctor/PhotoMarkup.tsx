"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Eraser, LoaderCircle, Undo2 } from "lucide-react";

import { savePhotoMarkup } from "@/lib/actions/photos";

export interface Stroke {
  /** Normalised 0-1 points. See the note on coordinates below. */
  points: [number, number][];
  color: string;
  width: number;
}

const INKS = [
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#facc15", name: "Yellow" },
  { hex: "#22d3ee", name: "Cyan" },
  { hex: "#ffffff", name: "White" },
] as const;

/**
 * Drawing on a clinical photograph.
 *
 * ── The marks never touch the image ──────────────────────────────────────
 * Strokes are stored as coordinates and painted on a canvas OVER the
 * photograph. The original file is never rewritten, which matters more than
 * it sounds: the unmarked image is the clinical record, and a circle drawn
 * round a lesion in March must not become part of what the February
 * photograph shows. It also means the marks can be undone, hidden to look at
 * the skin underneath, and layered per doctor.
 *
 * ── Why coordinates are normalised ───────────────────────────────────────
 * Every point is stored as a fraction of the image's width and height rather
 * than in pixels. A doctor marks a lesion on a phone in a treatment room and
 * opens the same photograph on a desktop monitor afterwards; pixel
 * coordinates would put the circle somewhere else entirely. Normalised ones
 * land on the same freckle at any size.
 *
 * ── Pointer events, not mouse events ─────────────────────────────────────
 * One set of handlers covers a mouse, a finger and a stylus. `touch-none`
 * stops the browser treating a drawing gesture as a scroll, which otherwise
 * makes the whole thing unusable on the device most of these are taken on.
 */
export default function PhotoMarkupEditor({
  photoId,
  src,
  initial,
  initialNote,
}: {
  photoId: string;
  src: string;
  initial: Stroke[];
  initialNote: string;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [note, setNote] = useState(initialNote);
  const [ink, setInk] = useState<string>(INKS[0].hex);
  const [show, setShow] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);

  /** Repaint everything. Cheap enough at these stroke counts to not optimise. */
  function repaint() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const { width, height } = wrap.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Match the backing store to the device pixel ratio, or every line is
    // soft on a phone, which is exactly where these are drawn.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!show) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const all = drawing.current ? [...strokes, drawing.current] : strokes;
    for (const s of all) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      // A dark halo under every line, so a rose stroke stays visible over
      // pale skin and a white one over a bright flash.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(s.points[0][0] * width, s.points[0][1] * height);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * width, y * height);
      ctx.stroke();
      ctx.restore();
    }
  }

  useEffect(repaint, [strokes, show]);

  // Redraw on resize: normalised points mean the marks follow the image, but
  // the canvas has to be re-measured to put them there.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => repaint());
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, show]);

  function pointAt(e: React.PointerEvent): [number, number] | null {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    // Clamped: a finger dragged off the edge should end the line at the edge
    // rather than record a point outside the photograph.
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    return [x, y];
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative aspect-[4/5] w-full touch-none overflow-hidden rounded-2xl bg-slate-900 select-none"
        onPointerDown={(e) => {
          if (!show) return;
          const p = pointAt(e);
          if (!p) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drawing.current = { points: [p], color: ink, width: 3 };
          setSaved(false);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = pointAt(e);
          if (!p) return;
          drawing.current.points.push(p);
          repaint();
        }}
        onPointerUp={() => {
          const s = drawing.current;
          drawing.current = null;
          // A tap is not a stroke. Two points minimum, or every accidental
          // touch leaves a dot on somebody's face.
          if (s && s.points.length >= 2) setStrokes((prev) => [...prev, s]);
          else repaint();
        }}
        onPointerLeave={() => {
          const s = drawing.current;
          drawing.current = null;
          if (s && s.points.length >= 2) setStrokes((prev) => [...prev, s]);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Clinical photograph"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {INKS.map((c) => (
          <button
            key={c.hex}
            type="button"
            aria-label={c.name}
            aria-pressed={ink === c.hex}
            onClick={() => setInk(c.hex)}
            className={`h-8 w-8 rounded-full border-2 transition ${
              ink === c.hex ? "border-slate-900 scale-110" : "border-slate-200"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}

        <button
          type="button"
          disabled={strokes.length === 0}
          onClick={() => setStrokes((p) => p.slice(0, -1))}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
        <button
          type="button"
          disabled={strokes.length === 0}
          onClick={() => setStrokes([])}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-rose-600 disabled:opacity-40"
        >
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>

        {/* Hiding the marks is not a nicety: the reason to draw on a
            photograph is to point at the skin, and you have to be able to see
            the skin. */}
        <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show marks
        </label>
      </div>

      <textarea
        rows={2}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="What you are pointing at."
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
      />

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await savePhotoMarkup({ photoId, strokes, note });
              if (!res.ok) setError(res.error ?? "Could not save that.");
              else setSaved(true);
            })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save marks
        </button>
        {saved && (
          <span className="text-xs font-semibold text-teal-700">Saved</span>
        )}
        <span className="text-xs text-slate-400">
          {strokes.length} mark{strokes.length === 1 ? "" : "s"} · the photograph
          itself is never changed
        </span>
      </div>
    </div>
  );
}
