"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useFieldError } from "@/components/admin/formContext";

/**
 * A text input with suggestions under it.
 *
 * Two constraints shaped this, and both are easy to get wrong here:
 *
 * 1. **The visible input IS the submitted field.** EntityForm is uncontrolled
 *    and reads `new FormData(form)`, so a widget that keeps its value in React
 *    state and never writes it to a named input saves nothing at all — the
 *    form submits happily and the field arrives empty.
 * 2. **The panel is positioned, not portalled.** A React portal escapes the
 *    `.theme-light` subtree, and every ink token in this app is inverted for
 *    the dark client theme — a portalled panel renders near-white text on
 *    white. Staying in the tree avoids the whole class of problem.
 *
 * Free text is always allowed. These lists are conveniences (specialties,
 * post-office areas), never whitelists.
 */

export default function Combobox({
  name,
  label,
  defaultValue = "",
  options,
  hint,
  placeholder,
  required,
  emptyText = "No matches: your own wording is fine",
  onPick,
  readOnly = false,
  error: explicitError,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: string[];
  hint?: string;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
  onPick?: (value: string) => void;
  /** Shown but not editable — a value that belongs to somebody else. */
  readOnly?: boolean;
  /** Wins over the form context, for forms that track errors themselves. */
  error?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  // Called unconditionally, never behind ?? — see admin/ui.tsx.
  const contextError = useFieldError(name);
  const error = explicitError ?? contextError;

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Keep in step when a parent fills the field programmatically (the pincode
  // lookup does this to the area field).
  useEffect(() => setValue(defaultValue), [defaultValue]);

  const q = value.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8)
    : options.slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (v: string) => {
    setValue(v);
    setOpen(false);
    setActive(-1);
    onPick?.(v);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(matches.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && matches[active]) {
      // Only intercept Enter when a suggestion is highlighted — otherwise the
      // form should submit as it normally would.
      e.preventDefault();
      pick(matches[active]);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-azure-600"> *</span>}
      </label>

      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => !readOnly && setOpen(true)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition placeholder:text-graphite-500 focus:border-azure-400 focus:ring-2 focus:ring-azure-100 ${
          readOnly
            ? "border-graphite-200 bg-graphite-50 text-graphite-500"
            : error
              ? "border-coral-300 bg-white text-graphite-900"
              : "border-graphite-200 bg-white text-graphite-900"
        }`}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 animate-scale-in overflow-y-auto rounded-xl border border-graphite-200 bg-white py-1 shadow-flat"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-graphite-500">{emptyText}</li>
          ) : (
            matches.map((o, i) => (
              <li key={o} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // onMouseDown, not onClick: the input's blur would close the
                  // panel before a click ever landed.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full px-3.5 py-2 text-left text-sm transition ${
                    i === active
                      ? "bg-azure-50 text-azure-800"
                      : "text-graphite-700 hover:bg-graphite-50"
                  }`}
                >
                  {o}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-coral-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
