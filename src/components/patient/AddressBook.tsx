"use client";

import { useState, useTransition } from "react";
import { Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { useFormValidation } from "@/hooks/useFormValidation";

import {
  deleteAddress,
  saveAddress,
  setDefaultAddress,
} from "@/lib/actions/address";

export interface AddressRow {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  isDefault: boolean;
}

/**
 * The client's saved places, and the only part of My Profile they can edit
 * from the page itself.
 *
 * This replaces two invented Chennai addresses that were shown to every client
 * as though they were their own. The section had no actions at all, so even a
 * client who noticed they were not theirs could do nothing about it.
 *
 * ── Nothing is composed for the reader ───────────────────────────────────
 * Every line is printed only if it was entered. The mock rendered
 * "{line2}, {pincode}" unconditionally, which for a real address with neither
 * would have printed a bare comma. `parts()` below is why that cannot happen.
 */
export default function AddressBook({ rows }: { rows: AddressRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setEditing(null);
        setAdding(false);
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">Saved addresses</h3>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> Add an address
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      )}

      {adding && (
        <AddressForm
          busy={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(data) => run(() => saveAddress(data))}
        />
      )}

      {rows.length === 0 && !adding ? (
        <div className="card-soft px-5 py-8 text-center">
          <MapPin
            aria-hidden
            className="mx-auto h-6 w-6 text-ink-muted"
            strokeWidth={1.6}
          />
          <p className="mt-2.5 text-sm font-semibold text-ink">
            No addresses saved
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
            Add one and it can be attached to a booking, so a doctor knows where
            they would be seeing you.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((a) =>
            editing === a.id ? (
              <li key={a.id} className="sm:col-span-2">
                <AddressForm
                  initial={a}
                  busy={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(data) => run(() => saveAddress({ ...data, id: a.id }))}
                />
              </li>
            ) : (
              <li key={a.id} className="card-soft flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-ink">{a.label}</p>
                  {a.isDefault && (
                    <span className="rounded-full bg-teal-400/[14%] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                      Default
                    </span>
                  )}
                </div>

                {/* Only what was entered. See the note at the top. */}
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                  {a.line1}
                  {parts([a.line2, a.city, a.pincode]) && (
                    <>
                      <br />
                      {parts([a.line2, a.city, a.pincode])}
                    </>
                  )}
                </p>
                {a.phone && (
                  <p className="mt-1.5 text-xs text-ink-muted">{a.phone}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                  {!a.isDefault && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setDefaultAddress(a.id))}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-white/10 transition hover:text-ink disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" /> Make default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditing(a.id);
                      setAdding(false);
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink disabled:opacity-60"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteAddress(a.id))}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300/80 transition hover:text-rose-200 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

/** Join only the pieces that exist, so no stray commas reach the page. */
function parts(values: (string | null | undefined)[]): string {
  return values.map((v) => v?.trim()).filter(Boolean).join(", ");
}

function AddressForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial?: AddressRow;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const formCheck = useFormValidation();
  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="card-soft mb-3 p-5"
      onSubmit={formCheck.guard((fd, form) => {
        onSubmit({
          label: String(fd.get("label") ?? ""),
          line1: String(fd.get("line1") ?? ""),
          line2: String(fd.get("line2") ?? ""),
          city: String(fd.get("city") ?? ""),
          pincode: String(fd.get("pincode") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          isDefault: fd.get("isDefault") === "on",
        });
      })}
    >
      {formCheck.summary}
      <p className="text-sm font-bold text-ink">
        {initial ? "Edit this address" : "Add an address"}
      </p>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <Field name="label" label="Name it" defaultValue={initial?.label} required
               placeholder="Home" />
        <Field name="phone" label="Phone at this address" defaultValue={initial?.phone ?? ""}
               placeholder="Optional" />
        <div className="sm:col-span-2">
          <Field name="line1" label="Address" defaultValue={initial?.line1} required
                 placeholder="Flat, building, street" />
        </div>
        <div className="sm:col-span-2">
          <Field name="line2" label="Area" defaultValue={initial?.line2 ?? ""}
                 placeholder="Optional" />
        </div>
        {/* No format is enforced on either of these. A form that insists on a
            shape the visitor's own country does not use is worse than one that
            takes what they type. */}
        <Field name="city" label="City" defaultValue={initial?.city ?? ""}
               placeholder="Optional" />
        <Field name="pincode" label="Postal code" defaultValue={initial?.pincode ?? ""}
               placeholder="Optional" />
      </div>

      <label className="mt-3.5 flex items-center gap-2.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={initial?.isDefault}
          className="h-4 w-4 rounded border-white/20 bg-white/10"
        />
        Use this one by default
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary !py-2 text-sm disabled:opacity-60"
        >
          {busy ? "Saving…" : initial ? "Save changes" : "Save address"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="btn-ghost !py-2 text-sm disabled:opacity-60"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none"
      />
    </label>
  );
}
