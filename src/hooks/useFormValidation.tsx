"use client";

import { useCallback, useRef, useState } from "react";

import { FieldErrorContext } from "@/components/admin/formContext";
import ValidationSummary from "@/components/admin/ValidationSummary";
import {
  clearSectionMarks,
  focusField,
  problemsFromFields,
  validateForm,
  type FieldProblem,
} from "@/lib/formValidation";

/**
 * The same validation EntityForm gives you, for a form that cannot use it.
 *
 * About two dozen forms in this app are hand-rolled rather than wrapped in
 * EntityForm — the clinic editor, the finance entries, the auth screens, the
 * booking drawer. Each of them called a server action straight from onSubmit
 * and relied on the browser to police the required fields, so each of them
 * had the same gap: one field at a time, a bubble that vanishes, no list of
 * what is left, and nothing to show which card the trouble is in.
 *
 * Rather than push every one of them through EntityForm — several genuinely
 * cannot, they submit to different actions from different buttons — this
 * gives them the identical behaviour in three lines:
 *
 *   const v = useFormValidation();
 *   <v.Provider>
 *     <form ref={v.formRef} onSubmit={v.guard((fd) => …)} noValidate>
 *       {v.summary}
 *
 * `noValidate` is not optional. Without it the browser intercepts first and
 * none of this runs.
 */
export function useFormValidation() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<FieldProblem[]>([]);

  /** Wraps a submit handler so it only ever sees a form that passed. */
  const guard = useCallback(
    (handler: (formData: FormData, form: HTMLFormElement) => void) =>
      (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;

        const check = validateForm(form);
        if (!check.ok) {
          setFields(check.fields);
          setProblems(check.problems);
          focusField(form, check.problems[0].name);
          return;
        }

        setFields({});
        setProblems([]);
        clearSectionMarks(form);
        handler(new FormData(form), form);
      },
    []
  );

  /**
   * Feeds the server's own field errors into the same display, so a rule the
   * browser could not have known about is presented identically.
   */
  const showServerErrors = useCallback((serverFields?: Record<string, string>) => {
    const form = formRef.current;
    if (!serverFields || Object.keys(serverFields).length === 0) {
      setFields({});
      setProblems([]);
      if (form) clearSectionMarks(form);
      return;
    }
    setFields(serverFields);
    if (form) {
      clearSectionMarks(form);
      const next = problemsFromFields(form, serverFields);
      setProblems(next);
      if (next.length > 0) focusField(form, next[0].name);
    }
  }, []);

  /** Clears everything — call it when the form is reset or reopened. */
  const reset = useCallback(() => {
    setFields({});
    setProblems([]);
    if (formRef.current) clearSectionMarks(formRef.current);
  }, []);

  const summary = (
    <ValidationSummary
      problems={problems}
      onJump={(name) => formRef.current && focusField(formRef.current, name)}
    />
  );

  /**
   * Wrap the form in this and every field from components/admin/ui.tsx
   * highlights itself, exactly as it does inside EntityForm.
   */
  const Provider = useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <FieldErrorContext.Provider value={fields}>
        {children}
      </FieldErrorContext.Provider>
    ),
    [fields]
  );

  return { formRef, fields, problems, guard, summary, showServerErrors, reset, Provider };
}
