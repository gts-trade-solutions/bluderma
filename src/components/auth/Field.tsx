"use client";

import { forwardRef, useId } from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Labelled input with inline validation messaging. Errors are wired via
 * aria-describedby + aria-invalid so screen readers announce them.
 */
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = "", ...props },
  ref
) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <input
        {...props}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-ink-muted ${
          error
            ? "border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-100"
            : "border-slate-200 bg-white focus:border-brand-400 focus:ring-brand-100"
        } ${className}`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Field;
