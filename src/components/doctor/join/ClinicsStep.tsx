"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ImageField from "@/components/admin/ImageField";
import PincodeAddressFields from "@/components/doctor/fields/PincodeAddressFields";
import { removeClinic, saveClinicStep } from "@/lib/actions/doctorOnboarding";
import { COMMON_FACILITIES } from "@/data/doctorJoin";
import { swatchFor } from "@/components/doctor/clinicColors";

/**
 * Step 3 — locations.
 *
 * The heart of the whole multi-clinic feature. A practitioner adds each place
 * they consult, with its own address, photographs and fee — because branches
 * of the same practice genuinely do charge differently, and a client searching
 * "near me" is searching for an address, not a practice name.
 */

interface ClinicView {
  feeInr: number;
  isPrimary: boolean;
  clinic: {
    id: string;
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    area: string;
    city: string;
    state: string;
    pincode: string;
    phone: string | null;
    colorKey: string;
    photos: { kind: string; url: string }[];
    facilities: { name: string }[];
  };
}

export default function ClinicsStep({
  doctor,
  // The wizard needs a "save and continue" footer; the practice page, where
  // this same component is reused for ongoing edits, does not.
  mode = "join",
  nextHref = "/doctor/join?step=4",
  backHref = "/doctor/join?step=2",
}: {
  doctor: { clinics: ClinicView[] };
  mode?: "join" | "manage";
  /** Overridden when this step is hosted inside the portal. */
  nextHref?: string;
  backHref?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(doctor.clinics.length === 0);

  return (
    <div className="space-y-5">
      {doctor.clinics.length > 0 && (
        <ul className="space-y-3">
          {doctor.clinics.map((c) => (
            <li key={c.clinic.id}>
              {editing === c.clinic.id ? (
                <ClinicForm
                  existing={c}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <ClinicCard
                  c={c}
                  onEdit={() => setEditing(c.clinic.id)}
                  soleLocation={doctor.clinics.length === 1}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <ClinicForm
          onDone={() => setAdding(false)}
          onCancel={doctor.clinics.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-bold text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
        >
          + Add another location
        </button>
      )}

      {mode === "join" && doctor.clinics.length > 0 && !adding && !editing && (
        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <Link href={nextHref} className="btn-primary">
            Save and continue
          </Link>
          <Link href={backHref} className="btn-ghost">
            Back
          </Link>
        </div>
      )}
    </div>
  );
}

function ClinicCard({
  c,
  onEdit,
  soleLocation,
}: {
  c: ClinicView;
  onEdit: () => void;
  soleLocation: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sw = swatchFor(c.clinic.colorKey);
  const exterior = c.clinic.photos.find((p) => p.kind === "EXTERIOR");
  const interior = c.clinic.photos.find((p) => p.kind === "INTERIOR");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${sw.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{c.clinic.name}</h3>
            {c.isPrimary && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                MAIN
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {c.clinic.addressLine1}
            {c.clinic.addressLine2 ? `, ${c.clinic.addressLine2}` : ""},{" "}
            {c.clinic.area}, {c.clinic.city} {c.clinic.pincode}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>
              {c.feeInr > 0
                ? `₹${c.feeInr.toLocaleString("en-IN")} consultation`
                : "Fee on enquiry"}
            </span>
            {c.clinic.phone && <span>{c.clinic.phone}</span>}
            <span>
              {[exterior && "exterior", interior && "interior"].filter(Boolean).join(" + ") ||
                "no photos yet"}
            </span>
            {c.clinic.facilities.length > 0 && (
              <span>{c.clinic.facilities.length} facilities</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onEdit}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Edit
          </button>
          {!soleLocation && (
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeClinic(c.clinic.id);
                  if (res.ok) router.refresh();
                  else setError(res.error ?? "Could not remove that.");
                })
              }
              className="rounded-full px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function ClinicForm({
  existing,
  onDone,
  onCancel,
}: {
  existing?: ClinicView;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const c = existing?.clinic;
  const exterior = c?.photos.find((p) => p.kind === "EXTERIOR")?.url ?? "";
  const interior = c?.photos.find((p) => p.kind === "INTERIOR")?.url ?? "";

  return (
    <form
      className="space-y-5 rounded-2xl border border-brand-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFields({});
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveClinicStep(fd);
          if (res.ok) {
            onDone();
            router.refresh();
          } else {
            setError(res.error ?? "Could not save that location.");
            setFields(res.fields ?? {});
          }
        });
      }}
    >
      <input type="hidden" name="clinicId" value={c?.id ?? ""} />

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <Text name="name" label="Clinic name" defaultValue={c?.name} error={fields.name} required />
      <Text
        name="addressLine1"
        label="Address"
        defaultValue={c?.addressLine1}
        error={fields.addressLine1}
        required
      />
      <Text
        name="addressLine2"
        label="Address line 2"
        defaultValue={c?.addressLine2 ?? ""}
        error={fields.addressLine2}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PIN code first, because it fills the other three. */}
        <PincodeAddressFields
          defaults={{
            pincode: c?.pincode ?? "",
            area: c?.area ?? "",
            city: c?.city ?? "",
            state: c?.state ?? "Tamil Nadu",
          }}
          errors={fields}
        />
        <Text name="phone" label="Clinic phone" defaultValue={c?.phone ?? ""} error={fields.phone} />
        <Text
          name="feeInr"
          label="Consultation fee (₹)"
          type="number"
          min={0}
          defaultValue={String(existing?.feeInr ?? 0)}
          hint="Leave 0 to show 'on enquiry' instead of a price."
          error={fields.feeInr}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageField
          name="exteriorImage"
          label="Outside the clinic"
          defaultValue={exterior}
          folder="clinics"
          hint="A shopfront or entrance shot, so people can find you."
        />
        <ImageField
          name="interiorImage"
          label="Inside the clinic"
          defaultValue={interior}
          folder="clinics"
          hint="Reception or a treatment room."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Facilities
        </label>
        <textarea
          name="facilities"
          rows={2}
          defaultValue={c?.facilities.map((f) => f.name).join(", ") ?? ""}
          placeholder={COMMON_FACILITIES.slice(0, 4).join(", ")}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
        />
        <p className="mt-1 text-xs text-slate-500">
          Comma separated. Common ones: {COMMON_FACILITIES.join(", ")}.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={existing?.isPrimary ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        This is my main location
      </label>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Saving…" : existing ? "Save changes" : "Add this location"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Text({
  name,
  label,
  hint,
  error,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
            : "border-slate-200 focus:border-brand-400 focus:ring-brand-500/15"
        }`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
