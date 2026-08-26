"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { AdminResult } from "@/lib/admin/form";
import {
  clearSectionMarks,
  focusField,
  validateForm,
  type FieldProblem,
} from "@/lib/formValidation";
import Hint from "@/components/Hint";
import { FieldErrorContext } from "./formContext";
import { Alert } from "./ui";
import ValidationSummary from "./ValidationSummary";

/**
 * The form wrapper every admin and onboarding screen submits through.
 *
 * ── Why `noValidate` ─────────────────────────────────────────────────────
 * Native validation is switched OFF and replaced, not disabled. The browser's
 * version stops at the first empty field, shows a bubble that vanishes, and —
 * because it blocks the submit outright — meant the field-error highlighting
 * this component already had could never run on a form with any `required`
 * on it. lib/formValidation.ts does the same job and reports all of it at
 * once, in our words, with the card it lives in outlined. The `required`
 * attributes stay exactly where they are; they are what it reads.
 *
 * The server's own checks are untouched and still authoritative. This only
 * saves a round trip and gives a better answer when it can.
 */
export default function EntityForm({
  action,
  submitLabel = "Save changes",
  cancelHref,
  cancelLabel = "Cancel",
  redirectTo,
  submitHint,
  cancelHint,
  children,
}: {
  action: (formData: FormData) => Promise<AdminResult>;
  submitLabel?: string;
  cancelHref: string;
  /** "Cancel" is wrong in a wizard, where the secondary link goes back a step. */
  cancelLabel?: string;
  /** Where to go after a successful save. Stays put when omitted. */
  redirectTo?: string;
  /**
   * What the save button is for, shown on hover and focus.
   *
   * Onboarding is the one place in the app where every control is being met
   * for the first time, and "Save and continue" does not say whether the
   * answers are kept if the browser is closed. Omitted elsewhere: a tooltip
   * on a button whose job is obvious is noise.
   */
  submitHint?: string;
  cancelHint?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [saved, setSaved] = useState<string | true | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    setError(null);
    setSaved(null);

    // ── The client pass ──────────────────────────────────────────────
    const check = validateForm(form);
    if (!check.ok) {
      setFields(check.fields);
      setProblems(check.problems);
      // Straight to the first unanswered question rather than to the top of
      // the page: the summary is there when they want the whole list, but
      // what they asked for by pressing Save was to finish.
      focusField(form, check.problems[0].name);
      return;
    }

    setFields({});
    setProblems([]);
    clearSectionMarks(form);

    const formData = new FormData(form);

    startTransition(async () => {
      const res = await action(formData);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        setFields(res.fields ?? {});

        // Mark the cards the server complained about, so a rule only the
        // server can check ("that registration number is already listed")
        // highlights its section exactly as a missing field does.
        const named = Object.keys(res.fields ?? {});
        if (formRef.current && named.length > 0) {
          for (const name of named) {
            formRef.current
              .querySelector(`[name="${CSS.escape(name)}"]`)
              ?.closest("[data-form-section]")
              ?.setAttribute("data-invalid", "true");
          }
          focusField(formRef.current, named[0]);
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      setSaved(res.message ?? true);
      // A message worth reading is a message worth staying on the page for.
      if (redirectTo && !res.message) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <FieldErrorContext.Provider value={fields}>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        {error && <Alert>{error}</Alert>}
        <ValidationSummary
          problems={problems}
          onJump={(name) => formRef.current && focusField(formRef.current, name)}
        />
        {saved && !error && (
          <Alert tone={typeof saved === "string" ? "info" : "success"}>
            {typeof saved === "string" ? saved : "Saved."}
          </Alert>
        )}

        {children}

        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <MaybeHint text={submitHint}>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary disabled:opacity-60"
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          </MaybeHint>
          <MaybeHint text={cancelHint}>
            <Link href={cancelHref} className="btn-ghost">
              {cancelLabel}
            </Link>
          </MaybeHint>
        </div>
      </form>
    </FieldErrorContext.Provider>
  );
}

/** Wraps in a Hint only when there is something worth saying. */
function MaybeHint({
  text,
  children,
}: {
  text?: string;
  children: React.ReactNode;
}) {
  if (!text) return <>{children}</>;
  return <Hint text={text}>{children}</Hint>;
}
