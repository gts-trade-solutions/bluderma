"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";

import { getAftercareDraft, issueAftercareSheet } from "@/lib/actions/aftercare";

export interface RecentVisit {
  id: string;
  label: string;
  patientName: string;
  patientUserId: string | null;
  procedure: string;
  /** yyyy-mm-dd */
  date: string;
}

/**
 * Issuing a post-procedure aftercare sheet.
 *
 * ── The standing additions ───────────────────────────────────────────────
 * The clinic's requirement was that a doctor's own extra instructions come
 * back the next time they issue for the same treatment. So the procedure name
 * is the key, and this asks the server for the saved draft whenever that field
 * settles: type "CO2 laser resurfacing" and whatever you wrote last time for
 * CO2 laser appears, ready to edit.
 *
 * Two details matter more than they look:
 *
 *   - the lookup NEVER overwrites text the doctor has already typed. Somebody
 *     mid-sentence when the draft arrives would otherwise lose their words,
 *     which is the kind of thing that makes people stop trusting a form.
 *   - "remember for next time" can be switched off, so a one-off instruction
 *     for one patient does not silently become standing advice.
 */
export default function AftercareForm({
  visits,
  defaultEmergencyContact,
}: {
  visits: RecentVisit[];
  defaultEmergencyContact: string;
}) {
  const [procedure, setProcedure] = useState("");
  const [notes, setNotes] = useState("");
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  // True once the doctor edits the notes box themselves. From that point the
  // lookup stops writing into it.
  const touched = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const name = procedure.trim();
    if (name.length < 3) return;
    let cancelled = false;

    // Debounced: this fires while somebody is still typing a treatment name.
    const t = window.setTimeout(async () => {
      const draft = await getAftercareDraft(name);
      if (cancelled || !draft) return;
      setNotesFor(draft.notesFor);
      if (!touched.current && draft.doctorNotes) setNotes(draft.doctorNotes);
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [procedure]);

  function pick(v: RecentVisit) {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("patientName") as HTMLInputElement).value = v.patientName;
    (f.elements.namedItem("patientUserId") as HTMLInputElement).value =
      v.patientUserId ?? "";
    (f.elements.namedItem("appointmentId") as HTMLInputElement).value = v.id;
    (f.elements.namedItem("procedureDate") as HTMLInputElement).value = v.date;
    setProcedure(v.procedure);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDone(false);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await issueAftercareSheet({
            appointmentId: String(fd.get("appointmentId") ?? "") || undefined,
            patientUserId: String(fd.get("patientUserId") ?? "") || undefined,
            patientName: String(fd.get("patientName") ?? ""),
            procedure,
            procedureDate: String(fd.get("procedureDate") ?? ""),
            reviewOn: String(fd.get("reviewOn") ?? ""),
            doctorNotes: notes,
            emergencyContact: String(fd.get("emergencyContact") ?? ""),
            rememberNotes: remember,
          });
          if (!res.ok) setError(res.error ?? "Something went wrong.");
          else {
            setDone(true);
            touched.current = false;
            formRef.current?.reset();
            setProcedure("");
            setNotes("");
          }
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="appointmentId" />
      <input type="hidden" name="patientUserId" />

      {visits.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fill from a recent visit
          </p>
          <div className="flex flex-wrap gap-2">
            {visits.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => pick(v)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Patient name" name="patientName" required />
        <Field
          label="Procedure"
          name="procedure"
          required
          value={procedure}
          onChange={setProcedure}
        />
        <Field label="Date of procedure" name="procedureDate" type="date" required />
        <Field label="Review / next visit" name="reviewOn" type="date" />
        <div className="sm:col-span-2">
          <Field
            label="Emergency contact"
            name="emergencyContact"
            defaultValue={defaultEmergencyContact}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="doctorNotes"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
          >
            Your own instructions for this patient
          </label>
          {notesFor && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
              <RotateCcw className="h-3 w-3" />
              Filled from your last {notesFor} sheet
            </span>
          )}
        </div>
        <textarea
          id="doctorNotes"
          rows={5}
          value={notes}
          onChange={(e) => {
            touched.current = true;
            setNotes(e.target.value);
          }}
          placeholder="Anything specific to this patient. This overrides the standard list on the sheet, and the sheet says so."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
        />
        <label className="mt-2 flex items-center gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Remember these for the next {procedure.trim() || "treatment"} sheet
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      {done && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700">
          <Check className="h-4 w-4" /> Issued. It is in the patient&apos;s profile now.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-3 text-sm font-extrabold text-white transition hover:from-brand-700 hover:to-teal-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Issue the sheet
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={onChange ? undefined : defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
      />
    </label>
  );
}
