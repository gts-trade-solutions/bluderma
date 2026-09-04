"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";

import { getAftercareDraft, issueAftercareSheet } from "@/lib/actions/aftercare";
import { useFormValidation } from "@/hooks/useFormValidation";
import ClinicalNoteField from "@/components/doctor/fields/ClinicalNoteField";
import ConfirmModal, { ConfirmRow } from "@/components/doctor/ConfirmModal";

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
 * Issuing a treatment sheet — before the procedure, or after it.
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
 *
 * ── Before as well as after ──────────────────────────────────────────────
 * The same form issues both. A pre-treatment sheet is the same document with
 * a future date on it, and the platform had only ever sent the second half —
 * which is the wrong way round for the things that actually go wrong. The
 * standing notes are kept per side, because "stop retinol a week before" and
 * "no retinol for a week after" are different instructions naming the same
 * product.
 *
 * ── Why it ends in a modal ───────────────────────────────────────────────
 * Issuing is one-way: it lands in a patient's record and their inbox, and
 * there is no unsend. The confirmation restates the patient's name and what
 * they are about to be told, because a submit button at the end of a long
 * form is pressed by somebody who stopped reading two fields ago.
 */
export default function AftercareForm({
  visits,
  defaultEmergencyContact,
  aiEnabled = false,
  /** Which side this form is issuing. The page renders one of each. */
  kind = "POST",
}: {
  visits: RecentVisit[];
  defaultEmergencyContact: string;
  aiEnabled?: boolean;
  kind?: "PRE" | "POST";
}) {
  const isPre = kind === "PRE";
  const [procedure, setProcedure] = useState("");
  const [notes, setNotes] = useState("");
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const formCheck = useFormValidation();

  // Held between the doctor pressing Issue and confirming it in the modal.
  // Captured from the form rather than re-read on confirm, so what they
  // approved in the dialog is exactly what is sent.
  const [confirming, setConfirming] = useState<null | {
    appointmentId: string;
    patientUserId: string;
    patientName: string;
    procedureDate: string;
    reviewOn: string;
    arriveAt: string;
    emergencyContact: string;
  }>(null);

  // True once the doctor edits the notes box themselves. From that point the
  // lookup stops writing into it.
  const touched = useRef(false);

  useEffect(() => {
    const name = procedure.trim();
    if (name.length < 3) return;
    let cancelled = false;

    // Debounced: this fires while somebody is still typing a treatment name.
    const t = window.setTimeout(async () => {
      const draft = await getAftercareDraft(name, kind);
      if (cancelled || !draft) return;
      setNotesFor(draft.notesFor);
      if (!touched.current && draft.doctorNotes) setNotes(draft.doctorNotes);
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [procedure, kind]);

  function pick(v: RecentVisit) {
    const f = formCheck.formRef.current;
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
      ref={formCheck.formRef}
      noValidate
      // Validates, then asks. The action itself runs from the modal.
      onSubmit={formCheck.guard((fd) => {
        setError(null);
        setDone(false);
        setConfirming({
          appointmentId: String(fd.get("appointmentId") ?? ""),
          patientUserId: String(fd.get("patientUserId") ?? ""),
          patientName: String(fd.get("patientName") ?? ""),
          procedureDate: String(fd.get("procedureDate") ?? ""),
          reviewOn: String(fd.get("reviewOn") ?? ""),
          arriveAt: String(fd.get("arriveAt") ?? ""),
          emergencyContact: String(fd.get("emergencyContact") ?? ""),
        });
      })}
      className="space-y-4"
    >
      {formCheck.summary}
      <input type="hidden" name="appointmentId" />
      <input type="hidden" name="patientUserId" />

      {visits.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-graphite-500">
            Fill from a recent visit
          </p>
          <div className="flex flex-wrap gap-2">
            {visits.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => pick(v)}
                className="rounded-full bg-graphite-100 px-3 py-1.5 text-xs font-semibold text-graphite-700 transition hover:bg-graphite-200"
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
        <Field
          label={isPre ? "Date of the procedure" : "Date of procedure"}
          name="procedureDate"
          type="date"
          required
        />
        {isPre ? (
          // Some procedures need numbing an hour ahead, so "arrive at" is
          // genuinely not the appointment time and is the single most useful
          // line on a pre-treatment sheet.
          <Field
            label="Ask them to arrive at"
            name="arriveAt"
            placeholder="e.g. 09:15, an hour before"
          />
        ) : (
          <Field label="Review / next visit" name="reviewOn" type="date" />
        )}
        <div className="sm:col-span-2">
          <Field
            label="Emergency contact"
            name="emergencyContact"
            defaultValue={defaultEmergencyContact}
          />
        </div>
      </div>

      <div>
        {notesFor && (
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-2.5 py-1 text-[11px] font-semibold text-mint-800">
            <RotateCcw className="h-3 w-3" />
            Filled from your last {notesFor} {isPre ? "pre-treatment" : "aftercare"} sheet
          </p>
        )}
        {/*
          Keyed on the standing draft, so a note arriving from the server
          replaces the uncontrolled textarea's contents. Without the key the
          field would keep whatever was in it and the draft would appear to
          have been ignored.
        */}
        <ClinicalNoteField
          key={`${kind}-${notesFor ?? "none"}-${notes.slice(0, 24)}`}
          name="doctorNotes"
          label="Your own instructions for this patient"
          kind={kind}
          aiEnabled={aiEnabled}
          defaultValue={notes}
          rows={5}
          placeholder={
            isPre
              ? "What this patient in particular has to do or stop before they come. Overrides the standard list, and the sheet says so."
              : "Anything specific to this patient. This overrides the standard list on the sheet, and the sheet says so."
          }
          hint="Press Dictate and say it — most of these are written between patients."
        />
        <label className="mt-2 flex items-center gap-2.5 text-sm text-graphite-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-graphite-300"
          />
          Remember these for the next {procedure.trim() || "treatment"}{" "}
          {isPre ? "pre-treatment" : "aftercare"} sheet
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-2.5 text-sm text-coral-700">
          {error}
        </p>
      )}
      {done && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-mint-200 bg-mint-50 px-4 py-2.5 text-sm font-semibold text-mint-800">
          <Check className="h-4 w-4" /> Issued. It is in the patient&apos;s
          profile now.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-extrabold text-graphite-900 shadow-flat transition hover:bg-gold-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-graphite-900 focus-visible:ring-offset-2"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {isPre ? "Send the before-treatment sheet" : "Issue the aftercare sheet"}
      </button>

      {/* One-way, so it is asked for rather than assumed. See ConfirmModal. */}
      <ConfirmModal
        open={confirming !== null}
        busy={pending}
        title={isPre ? "Send this before-treatment sheet?" : "Issue this aftercare sheet?"}
        lead={
          confirming
            ? `It goes into ${confirming.patientName}'s record and they are emailed a link straight away. There is no unsend.`
            : undefined
        }
        confirmLabel={isPre ? "Yes, send it" : "Yes, issue it"}
        cancelLabel="Not yet"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          const c = confirming;
          // Read off the form at confirm time: the notes field is
          // uncontrolled so that dictation can write into it directly.
          const written =
            (formCheck.formRef.current?.elements.namedItem(
              "doctorNotes"
            ) as HTMLTextAreaElement | null)?.value ?? "";

          start(async () => {
            const res = await issueAftercareSheet({
              kind,
              appointmentId: c.appointmentId || undefined,
              patientUserId: c.patientUserId || undefined,
              patientName: c.patientName,
              procedure,
              procedureDate: c.procedureDate,
              reviewOn: c.reviewOn,
              arriveAt: c.arriveAt,
              doctorNotes: written,
              emergencyContact: c.emergencyContact,
              rememberNotes: remember,
            });
            if (!res.ok) {
              setError(res.error ?? "Something went wrong.");
              setConfirming(null);
              return;
            }
            setDone(true);
            setConfirming(null);
            touched.current = false;
            formCheck.formRef.current?.reset();
            setProcedure("");
            setNotes("");
          });
        }}
      >
        {confirming && (
          <dl>
            <ConfirmRow label="Patient">{confirming.patientName}</ConfirmRow>
            <ConfirmRow label="Procedure">{procedure}</ConfirmRow>
            <ConfirmRow label={isPre ? "Due on" : "Done on"}>
              {confirming.procedureDate || "—"}
            </ConfirmRow>
            {isPre && confirming.arriveAt && (
              <ConfirmRow label="Arrive at">{confirming.arriveAt}</ConfirmRow>
            )}
            {!isPre && confirming.reviewOn && (
              <ConfirmRow label="Review on">{confirming.reviewOn}</ConfirmRow>
            )}
            <ConfirmRow label="Your notes">
              {(
                (formCheck.formRef.current?.elements.namedItem(
                  "doctorNotes"
                ) as HTMLTextAreaElement | null)?.value ?? ""
              ).trim() || (
                <span className="text-graphite-500">
                  None — they get the standard list only
                </span>
              )}
            </ConfirmRow>
            <ConfirmRow label="Also includes">
              The standard {isPre ? "before-treatment" : "aftercare"}{" "}
              instructions, copied in as they read today.
            </ConfirmRow>
          </dl>
        )}
      </ConfirmModal>
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
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-graphite-500">
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={onChange ? undefined : defaultValue}
        value={value}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-xl border border-graphite-200 bg-white px-3.5 py-2.5 text-sm text-graphite-900 placeholder:text-graphite-500 focus:border-azure-400 focus:outline-none"
      />
    </label>
  );
}
