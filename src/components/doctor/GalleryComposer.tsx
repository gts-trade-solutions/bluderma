"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";

import { createGalleryCase } from "@/lib/actions/gallery";
import { uploadFile } from "@/lib/uploadClient";
import { useFormValidation } from "@/hooks/useFormValidation";

export interface GalleryPatient {
  userId: string;
  name: string;
}

interface Uploaded {
  url: string;
  key: string;
  preview: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Preparing a before-and-after case.
 *
 * Nothing this produces is visible to anybody but the doctor and the patient
 * being asked. The case is created DRAFT with no consent, the patient sees the
 * actual pair in their own profile, and only their agreement makes publishing
 * possible.
 *
 * Images go to the private `patients/` prefix, which is why they are never
 * linked to directly: /api/gallery/[id]/[side] re-checks consent on every
 * request, so withdrawing it actually takes the pictures down.
 */
export default function GalleryComposer({
  patients,
}: {
  patients: GalleryPatient[];
}) {
  const [before, setBefore] = useState<Uploaded | null>(null);
  const [after, setAfter] = useState<Uploaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<"before" | "after" | null>(null);
  const [pending, start] = useTransition();
  const formCheck = useFormValidation();

  async function upload(file: File, side: "before" | "after") {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That image is over 8MB. Please pick a smaller one.");
      return;
    }
    setBusy(side);

    // Private prefix. See the note at the top.
    const res = await uploadFile(file, "patients");
    setBusy(null);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    const row = {
      url: res.file.url,
      key: res.file.key,
      preview: URL.createObjectURL(file),
    };
    if (side === "before") setBefore(row);
    else setAfter(row);
  }

  const ready = before && after;

  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="space-y-4"
      onSubmit={formCheck.guard((fd, form) => {
        if (!before || !after) return;
        setError(null);
        setDone(false);
        start(async () => {
          const res = await createGalleryCase({
            patientUserId: String(fd.get("patientUserId") ?? ""),
            treatmentName: String(fd.get("treatmentName") ?? ""),
            caption: String(fd.get("caption") ?? ""),
            detail: String(fd.get("detail") ?? ""),
            beforeUrl: before.url,
            beforeKey: before.key,
            afterUrl: after.url,
            afterKey: after.key,
          });
          if (!res.ok) setError(res.error ?? "Something went wrong.");
          else {
            setDone(true);
            setBefore(null);
            setAfter(null);
            formCheck.formRef.current?.reset();
          }
        });
      })}
    >
      {formCheck.summary}
      <div className="grid gap-3 sm:grid-cols-2">
        <Slot
          label="Before"
          value={before}
          busy={busy === "before"}
          onPick={(f) => upload(f, "before")}
          onClear={() => setBefore(null)}
        />
        <Slot
          label="After"
          value={after}
          busy={busy === "after"}
          onPick={(f) => upload(f, "after")}
          onClear={() => setAfter(null)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Which patient
          </span>
          <select
            name="patientUserId"
            required
            defaultValue=""
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
          >
            <option value="" disabled>
              Choose someone you have seen
            </option>
            {patients.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Treatment
          </span>
          <input
            name="treatmentName"
            required
            placeholder="Acne scar resurfacing"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            What a viewer needs to know
          </span>
          {/* Sessions and timescale, because a pair with neither invites the
              reader to assume one session and a fortnight. */}
          <input
            name="detail"
            placeholder="4 sessions over 3 months"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Caption{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <input
            name="caption"
            placeholder="Anything else worth saying about this case"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
          />
        </label>
      </div>

      <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
        The patient will be asked to agree before this can be shown. They see
        these exact images, and they can withdraw at any time, which takes them
        down immediately.
      </p>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      {done && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700">
          <Check className="h-4 w-4" /> Sent to the patient to agree.
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-3 text-sm font-extrabold text-white transition hover:from-brand-700 hover:to-teal-700 disabled:opacity-50"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Ask the patient
      </button>
      {!ready && (
        <span className="ml-3 text-xs text-slate-400">Both images first.</span>
      )}
    </form>
  );
}

function Slot({
  label,
  value,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  value: Uploaded | null;
  busy: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.preview}
              alt={`${label}, just uploaded`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onClear}
              aria-label={`Remove the ${label.toLowerCase()} image`}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="grid h-full w-full place-items-center gap-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            {busy ? (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-semibold">Choose an image</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
