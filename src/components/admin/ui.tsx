"use client";

import Link from "next/link";
import { useId } from "react";

import { useFieldError } from "./formContext";

/* ------------------------------- Layout --------------------------------- */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    // data-form-section is what lets a failed validation outline the whole
    // card rather than only the field inside it — see lib/formValidation.ts.
    <section
      data-form-section
      className="rounded-2xl border border-slate-200 bg-white"
    >
      {title && (
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-bold text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-rose-50 text-rose-700 ring-rose-100",
    success: "bg-teal-50 text-teal-800 ring-teal-100",
    info: "bg-brand-50 text-brand-800 ring-brand-100",
  }[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${styles}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Table --------------------------------- */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    // Wide tables scroll inside their own container rather than pushing the
    // page sideways.
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-slate-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`border-b border-slate-50 px-4 py-3 align-middle ${className}`}>
      {children}
    </td>
  );
}

/* -------------------------------- Fields -------------------------------- */

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

interface BaseFieldProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Wrap({
  label,
  id,
  hint,
  error,
  required,
  children,
}: BaseFieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  error: explicitError,
  required,
  ...props
}: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  // Hook must run unconditionally — `??` would short-circuit the call.
  const contextError = useFieldError(name);
  const error = explicitError ?? contextError;
  return (
    <Wrap {...{ label, name, id, hint, error, required }}>
      <input
        {...props}
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-rose-300" : ""}`}
      />
    </Wrap>
  );
}

export function TextArea({
  label,
  name,
  hint,
  error: explicitError,
  required,
  rows = 4,
  ...props
}: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const contextError = useFieldError(name);
  const error = explicitError ?? contextError;
  return (
    <Wrap {...{ label, name, id, hint, error, required }}>
      <textarea
        {...props}
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} resize-y ${error ? "border-rose-300" : ""}`}
      />
    </Wrap>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error: explicitError,
  required,
  options,
  ...props
}: BaseFieldProps &
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
  }) {
  const id = useId();
  const contextError = useFieldError(name);
  const error = explicitError ?? contextError;
  return (
    <Wrap {...{ label, name, id, hint, error, required }}>
      <select
        {...props}
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-rose-300" : ""}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  defaultChecked,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </label>
    </div>
  );
}

/* ------------------------------- Actions -------------------------------- */

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={variant === "primary" ? "btn-primary" : "btn-ghost"}
    >
      {children}
    </Link>
  );
}
