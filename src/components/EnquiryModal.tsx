"use client";

import { useBackToClose } from "@/hooks/useBackToClose";

import { useEffect, useState } from "react";
import { submitEnquiry } from "@/lib/actions/enquiry";

interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the enquiry with the treatment / product context. */
  treatmentName: string;
  productName: string;
  /** Links the resulting lead to the treatment row. */
  treatmentSlug?: string;
  audience?: "doctor" | "patient";
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  quantity: string;
  message: string;
};

const empty: FormState = {
  name: "",
  email: "",
  phone: "",
  organisation: "",
  quantity: "1",
  message: "",
};

export default function EnquiryModal({
  open,
  onClose,
  treatmentName,
  productName,
  treatmentSlug,
  audience = "doctor",
}: EnquiryModalProps) {
  // Browser Back closes this rather than leaving the page behind it.
  useBackToClose(open, onClose);

  const [form, setForm] = useState<FormState>(empty);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setBusy(false);
      setError(null);
      setFields({});
      setForm(empty);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    const res = await submitEnquiry({
      audience,
      name: form.name,
      email: form.email,
      phone: form.phone,
      organisation: form.organisation,
      quantity: audience === "doctor" ? form.quantity : undefined,
      message: form.message,
      treatmentSlug,
      productName,
    });

    if (!res.ok) {
      setError(res.error ?? "Could not send your enquiry.");
      setFields(res.fields ?? {});
      setBusy(false);
      return;
    }

    setSubmitted(true);
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Enquiry for ${productName}`}
    >
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="theme-light relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-teal-50 p-6">
          <div>
            <p className="section-eyebrow">Enquiry to order</p>
            <h3 className="mt-1 text-xl font-bold text-ink">{productName}</h3>
            <p className="text-sm text-ink-muted">
              For {treatmentName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-muted transition hover:bg-white hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h4 className="text-lg font-bold text-ink">Enquiry received</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Thanks, {form.name || "there"}. Your enquiry for{" "}
              <span className="font-medium text-ink">{productName}</span> has
              reached our team. We&apos;ll get back to you shortly.
            </p>
            <button onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
              >
                {error}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={fields.name}>
                <input
                  required
                  value={form.name}
                  onChange={update("name")}
                  className="input"
                  placeholder="Dr. A. Sharma"
                />
              </Field>
              <Field label="Email" required error={fields.email}>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className="input"
                  placeholder="you@clinic.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={update("phone")}
                  className="input"
                  placeholder="+91 …"
                />
              </Field>
              <Field
                label={audience === "doctor" ? "Clinic / Organisation" : "City"}
              >
                <input
                  value={form.organisation}
                  onChange={update("organisation")}
                  className="input"
                  placeholder={
                    audience === "doctor" ? "BluDerma Skin Clinic" : "Chennai"
                  }
                />
              </Field>
            </div>

            {audience === "doctor" && (
              <Field label="Quantity / units">
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={update("quantity")}
                  className="input"
                />
              </Field>
            )}

            <Field label="Message">
              <textarea
                value={form.message}
                onChange={update("message")}
                rows={3}
                className="input resize-none"
                placeholder={`I'd like more information about ${productName}…`}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send enquiry"}
              </button>
            </div>
            <p className="pt-1 text-center text-xs text-ink-muted">
              We&apos;ll only use these details to respond to your enquiry.
            </p>
          </form>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 0.625rem 0.85rem;
          font-size: 0.875rem;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: #59b0ff;
          box-shadow: 0 0 0 3px rgba(89, 176, 255, 0.25);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-xs font-medium text-rose-600">
          {error}
        </span>
      )}
    </label>
  );
}
