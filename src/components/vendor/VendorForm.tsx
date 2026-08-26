"use client";

import { useRef, useState, useTransition } from "react";
import { Check, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";

import { applyAsVendor } from "@/lib/actions/vendor";
import { uploadFile } from "@/lib/uploadClient";
import { useFormValidation } from "@/hooks/useFormValidation";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The seller application.
 *
 * ── Why the licence is not optional ──────────────────────────────────────
 * Dispensing medicine is a licensed activity. Asking for the number, and for
 * the document, is the difference between a marketplace and a liability: the
 * alternative is listing prescription medicine on somebody's unverified claim
 * that they are allowed to sell it.
 *
 * The document goes to the private `credentials/` prefix, the same place a
 * practitioner's registration certificate lives, and is readable only through
 * a signed URL. The form says so, because somebody is about to upload a
 * regulatory document to a website and deserves to know where it lands.
 */
export default function VendorForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [licence, setLicence] = useState<{ url: string; key: string; name: string } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const v = useFormValidation();

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That file is over 8MB. Please upload a smaller scan.");
      return;
    }
    setUploading(true);

    // `vendor-licences/`, not `credentials/`. This form is public — an
    // applicant has no account — and `credentials/` is doctors-only, which is
    // why every licence upload here used to come back "Not permitted".
    const res = await uploadFile(file, "vendor-licences");
    setUploading(false);

    if (!res.ok) {
      setError(
        `${res.error} You can submit without it and send the licence separately.`
      );
      return;
    }
    setLicence({ url: res.file.url, key: res.file.key, name: file.name });
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-100 text-teal-700">
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 font-display text-xl font-extrabold text-slate-900">
          Application received
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Somebody will check your licence details and come back to you by email.
          We do not approve sellers automatically, so this takes a few working
          days.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-6"
      onSubmit={v.guard((fd, form) => {
        setError(null);
        start(async () => {
          const res = await applyAsVendor({
            businessName: String(fd.get("businessName") ?? ""),
            contactName: String(fd.get("contactName") ?? ""),
            email: String(fd.get("email") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            addressLine1: String(fd.get("addressLine1") ?? ""),
            addressLine2: String(fd.get("addressLine2") ?? ""),
            area: String(fd.get("area") ?? ""),
            city: String(fd.get("city") ?? ""),
            state: String(fd.get("state") ?? ""),
            pincode: String(fd.get("pincode") ?? ""),
            drugLicenceNo: String(fd.get("drugLicenceNo") ?? ""),
            drugLicenceUrl: licence?.url ?? "",
            drugLicenceKey: licence?.key ?? "",
            gstin: String(fd.get("gstin") ?? ""),
            categories: String(fd.get("categories") ?? ""),
            about: String(fd.get("about") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Something went wrong.");
          else setSent(true);
        });
      })}
    >
      {v.summary}
      <Section title="The business" step={1}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="businessName" label="Registered business name" required
                 placeholder="Sunrise Pharma Distributors" />
          <Field name="contactName" label="Who we should speak to" required
                 placeholder="Full name" />
          <Field name="email" label="Email" type="email" required
                 placeholder="orders@example.com" />
          <Field name="phone" label="Phone" required placeholder="+91 …" />
        </div>
      </Section>

      <Section title="Where you operate from" step={2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="addressLine1" label="Address" required
                   placeholder="Unit, building, street" />
          </div>
          <Field name="addressLine2" label="Address line 2" placeholder="Optional" />
          <Field name="area" label="Area" placeholder="Optional" />
          <Field name="city" label="City" required />
          <Field name="state" label="State or region" required />
          <Field name="pincode" label="Postal code" required />
        </div>
      </Section>

      <Section title="Licensing" step={3}>
        <div className="mb-4 flex gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-[13px] leading-relaxed text-amber-900">
            Medicines can only be sold by a licensed seller, so we check this
            before anyone is approved. Your licence goes to private storage and
            is readable only by the person reviewing it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="drugLicenceNo" label="Drug licence number" required
                 placeholder="As printed on the licence" />
          <Field name="gstin" label="GSTIN" placeholder="Optional" />
        </div>

        <div className="mt-4">
          <span className={labelClass}>
            A copy of the licence{" "}
            <span className="font-normal text-slate-400">(optional now)</span>
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-60"
          >
            {uploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {licence ? licence.name : "Upload a scan or photograph"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </Section>

      <Section title="What you stock" step={4}>
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>
              Categories you supply{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              name="categories"
              placeholder="Dermatology topicals, oral antibiotics, sunscreens"
              className={field}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Anything else{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              name="about"
              rows={4}
              placeholder="How long you have been trading, who you currently supply, delivery coverage."
              className={field}
            />
          </label>
        </div>
      </Section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-8 py-3 text-sm font-extrabold text-white shadow-[0_14px_34px_-10px_rgba(31,111,214,0.85)] transition hover:on-dark from-brand-700 hover:to-teal-700 disabled:opacity-60"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Send the application
        </button>
        <p className="text-xs text-slate-500">
          Submitting this does not create an account or a listing.
        </p>
      </div>
    </form>
  );
}

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-sm font-bold text-white">
          {step}
        </span>
        <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-slate-900">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {!required && (
          <span className="ml-1 font-normal text-slate-400">(optional)</span>
        )}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={field}
      />
    </label>
  );
}
