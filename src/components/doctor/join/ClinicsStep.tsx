"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Hint from "@/components/Hint";
import ImageField from "@/components/admin/ImageField";
import FacilityPicker from "@/components/doctor/fields/FacilityPicker";
import LocationPicker from "@/components/doctor/fields/LocationPicker";
import PincodeAddressFields from "@/components/doctor/fields/PincodeAddressFields";
import { useFormValidation } from "@/hooks/useFormValidation";
import { removeClinic, saveClinicStep } from "@/lib/actions/doctorOnboarding";
import { CATEGORY_LABEL } from "@/data/facilities";
import { swatchFor } from "@/components/doctor/clinicColors";

/**
 * Step 3 — locations.
 *
 * The heart of the multi-clinic feature. A practitioner adds each place they
 * consult, with its own address, landmark, photographs and fee — because
 * branches of the same practice genuinely do charge differently, and a client
 * searching "near me" is searching for an address, not a practice name.
 *
 * ── The three things this step now does that it did not ──────────────────
 *  1. **Finds the clinic if it is already here.** Clinic has always been a
 *     shared entity, but nothing in the form knew it, so every doctor created
 *     a fresh row and three dermatologists at one address produced three
 *     clinics. As the name and PIN code are typed, /api/clinics/match offers
 *     the candidates and the doctor joins one. Nothing is ever merged
 *     automatically — see the note in lib/clinicMatch.ts.
 *  2. **Asks for the landmark, and offers a pin.** In most Indian cities the
 *     landmark is the address that actually works, and Clinic.lat/lng have
 *     sat unwritten since they were added.
 *  3. **Offers the facilities instead of asking for a sentence.** Especially
 *     the equipment, which is the most persuasive thing on a clinic page and
 *     the one nobody ever typed into a comma-separated box.
 */

interface ClinicView {
  feeInr: number;
  isPrimary: boolean;
  clinic: {
    id: string;
    publicId: string | null;
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    area: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    colorKey: string;
    photos: { kind: string; url: string }[];
    facilities: { name: string; category: string | null }[];
    _count: { doctors: number };
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

  const none = doctor.clinics.length === 0;

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
          onCancel={
            doctor.clinics.length > 0 ? () => setAdding(false) : undefined
          }
        />
      ) : (
        <Hint
          className="w-full"
          side="top"
          text={
            none
              ? "Every place you consult at, with its own address and fee."
              : "If you practise in more than one place, use this. Each location keeps its own address, hours, photographs and consultation fee."
          }
        >
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-[10px] border-2 border-dashed border-graphite-300 bg-white px-4 py-5 text-sm font-bold text-graphite-600 transition hover:border-azure-400 hover:text-azure-700"
          >
            + Add another location
          </button>
        </Hint>
      )}

      {mode === "join" && doctor.clinics.length > 0 && !adding && !editing && (
        <div className="flex items-center gap-3 border-t border-graphite-100 pt-5">
          <Hint text="Saves your locations and opens the hours step, where you set when you see clients at each one.">
            <Link href={nextHref} className="btn-primary">
              Save and continue
            </Link>
          </Hint>
          <Hint text="Back to your registration details. Nothing here is lost.">
            <Link href={backHref} className="btn-ghost">
              Back
            </Link>
          </Hint>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- The card -------------------------------- */

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
  /* The card is a summary; the address opens the rest of it. A practitioner
     checking "is this the right branch" wants the photographs and the full
     address, and printing all of that for every location turned a page about
     three clinics into three screens. */
  const [open, setOpen] = useState(false);
  const sw = swatchFor(c.clinic.colorKey);
  const exterior = c.clinic.photos.filter((p) => p.kind === "EXTERIOR");
  const interior = c.clinic.photos.filter((p) => p.kind === "INTERIOR");
  const others = c.clinic.photos.filter(
    (p) => p.kind !== "EXTERIOR" && p.kind !== "INTERIOR"
  );
  const shared = c.clinic._count.doctors > 1;
  const mapQuery = encodeURIComponent(
    c.clinic.lat !== null && c.clinic.lng !== null
      ? `${c.clinic.lat},${c.clinic.lng}`
      : `${c.clinic.name}, ${c.clinic.addressLine1}, ${c.clinic.area}, ${c.clinic.city} ${c.clinic.pincode}`
  );

  return (
    <div className="rounded-[10px] border border-graphite-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${sw.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-graphite-900">{c.clinic.name}</h3>
            {/* The id a receptionist reads down a phone. Monospace and
                select-all: its whole job is being copied or quoted. */}
            {c.clinic.publicId && (
              <span className="select-all font-mono text-[10.5px] font-semibold tracking-wide text-graphite-500">
                {c.clinic.publicId}
              </span>
            )}
            {c.isPrimary && (
              <span className="rounded-full bg-azure-100 px-2 py-0.5 text-[10px] font-bold text-azure-800">
                MAIN
              </span>
            )}
            {shared && (
              <Hint text={`${c.clinic._count.doctors} practitioners hold hours here. The address, photographs and facilities are shared, so only an admin can change them.`}>
                <span className="rounded-full bg-graphite-100 px-2 py-0.5 text-[10px] font-bold text-graphite-600">
                  SHARED · {c.clinic._count.doctors}
                </span>
              </Hint>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="group/addr mt-0.5 flex w-full items-start gap-1.5 rounded-md text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-graphite-700 underline-offset-2 group-hover/addr:text-azure-700 group-hover/addr:underline">
                {c.clinic.addressLine1}
                {c.clinic.addressLine2 ? `, ${c.clinic.addressLine2}` : ""},{" "}
                {c.clinic.area}, {c.clinic.city} {c.clinic.pincode}
              </span>
              {c.clinic.landmark && (
                <span className="mt-0.5 block text-sm italic text-graphite-500">
                  {c.clinic.landmark}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={`mt-1 shrink-0 text-graphite-500 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-graphite-500">
            <span>
              {c.feeInr > 0
                ? `₹${c.feeInr.toLocaleString("en-IN")} consultation`
                : "Fee on enquiry"}
            </span>
            {c.clinic.phone && <span>{c.clinic.phone}</span>}
            <span>
              {c.clinic.photos.length > 0
                ? `${c.clinic.photos.length} photo${c.clinic.photos.length === 1 ? "" : "s"}`
                : "no photos yet"}
            </span>
            {c.clinic.lat !== null && <span>pinned on the map</span>}
            {c.clinic.facilities.length > 0 && (
              <span>{c.clinic.facilities.length} facilities</span>
            )}
          </p>

          {c.clinic.facilities.length > 0 && (
            <FacilitySummary facilities={c.clinic.facilities} />
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Hint
            text={
              shared
                ? "Change your own consultation fee here. The shared address and photographs are read-only."
                : "Change this location's details."
            }
          >
            <button
              onClick={onEdit}
              className="rounded-full border border-graphite-200 px-3 py-1.5 text-xs font-bold text-graphite-600 transition hover:bg-graphite-50"
            >
              Edit
            </button>
          </Hint>
          {!soleLocation && (
            <Hint text="Takes this location off your listing. The clinic itself stays, along with anyone else who practises there.">
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeClinic(c.clinic.id);
                    if (res.ok) router.refresh();
                    else setError(res.error ?? "Could not remove that.");
                  })
                }
                className="rounded-full px-3 py-1.5 text-xs font-bold text-coral-600 transition hover:bg-coral-50 disabled:opacity-50"
              >
                Remove
              </button>
            </Hint>
          )}
        </div>
      </div>
      {/* ── The whole location, once asked for ─────────────────────────
          Photographs first: "is this the right place" is answered by a
          picture faster than by an address, and a practitioner with three
          branches is checking exactly that. */}
      {open && (
        <div className="mt-3 border-t border-graphite-200 pt-3">
          {c.clinic.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {[...exterior, ...interior, ...others].map((ph) => (
                <figure
                  key={ph.url}
                  className="overflow-hidden rounded-lg border border-graphite-200 bg-graphite-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ph.url}
                    alt={`${c.clinic.name} — ${ph.kind.toLowerCase()}`}
                    loading="lazy"
                    className="h-28 w-full object-cover sm:h-32"
                  />
                  <figcaption className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">
                    {ph.kind.toLowerCase()}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-graphite-300 px-3 py-4 text-center text-xs text-graphite-600">
              No photographs of this location yet. Add an exterior shot and an
              interior one in Edit — clients pick a clinic by looking at it.
            </p>
          )}

          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Detail label="Address">
              {c.clinic.addressLine1}
              {c.clinic.addressLine2 ? `, ${c.clinic.addressLine2}` : ""}
              <br />
              {c.clinic.area}, {c.clinic.city} {c.clinic.pincode}
              <br />
              {c.clinic.state}
            </Detail>
            {c.clinic.landmark && (
              <Detail label="Landmark">{c.clinic.landmark}</Detail>
            )}
            {c.clinic.phone && <Detail label="Phone">{c.clinic.phone}</Detail>}
            <Detail label="Consultation fee">
              {c.feeInr > 0
                ? `₹${c.feeInr.toLocaleString("en-IN")}`
                : "On enquiry"}
            </Detail>
            <Detail label="On the map">
              {c.clinic.lat !== null && c.clinic.lng !== null
                ? "Pinned"
                : "Not pinned yet"}
              {" · "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-azure-700 underline-offset-2 hover:underline"
              >
                Open in Maps
              </a>
            </Detail>
          </dl>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">
        {label}
      </dt>
      <dd className="mt-0.5 leading-relaxed text-graphite-800">{children}</dd>
    </div>
  );
}

/** Facilities on the card, grouped, so thirty of them stay readable. */
function FacilitySummary({
  facilities,
}: {
  facilities: { name: string; category: string | null }[];
}) {
  const groups = new Map<string, string[]>();
  for (const f of facilities) {
    const key = f.category ?? "OTHER";
    groups.set(key, [...(groups.get(key) ?? []), f.name]);
  }

  return (
    <ul className="mt-2 space-y-0.5">
      {[...groups.entries()].map(([cat, names]) => (
        <li key={cat} className="text-xs text-graphite-500">
          <span className="font-semibold text-graphite-600">
            {cat === "OTHER"
              ? "Also here"
              : (CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat)}
            :
          </span>{" "}
          {names.join(", ")}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------- The form -------------------------------- */

interface MatchRow {
  id: string;
  name: string;
  addressLine1: string;
  landmark: string | null;
  area: string;
  city: string;
  pincode: string;
  reason: string;
  doctorCount: number;
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
  const v = useFormValidation();

  const c = existing?.clinic;
  const exterior = c?.photos.find((p) => p.kind === "EXTERIOR")?.url ?? "";
  const interior = c?.photos.find((p) => p.kind === "INTERIOR")?.url ?? "";

  // Above one occupant the premises belong to more than one practice, and the
  // shared fields stop being this doctor's to change. Enforced again in
  // saveClinicStep — this only stops them being offered.
  const shared = (c?._count.doctors ?? 0) > 1;

  // ── "Is this clinic already here?" ────────────────────────────────────
  const [name, setName] = useState(c?.name ?? "");
  const [address1, setAddress1] = useState(c?.addressLine1 ?? "");
  const [pincode, setPincode] = useState(c?.pincode ?? "");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [joining, setJoining] = useState<MatchRow | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useClinicMatches({
    name,
    addressLine1: address1,
    pincode,
    excludeId: c?.id ?? "",
    enabled: !shared && !joining && !dismissed,
    onResult: setMatches,
  });

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await saveClinicStep(fd);
      if (res.ok) {
        onDone();
        router.refresh();
      } else {
        setError(res.error ?? "Could not save that location.");
        v.showServerErrors(res.fields);
      }
    });
  }

  // ── Joining an existing clinic ────────────────────────────────────────
  // A different form entirely: the premises are already described, so the
  // only questions left are this practitioner's own fee and whether it is
  // their main location.
  if (joining) {
    return (
      <form
        ref={v.formRef}
        noValidate
        className="space-y-5 rounded-[10px] border-2 border-azure-300 bg-azure-50/40 p-5"
        onSubmit={v.guard(submit)}
      >
        {v.summary}
        <input type="hidden" name="joinClinicId" value={joining.id} />
        {/* The schema still requires these, and they are what the clinic
            already says. Never read on the join path — see saveClinicStep. */}
        <input type="hidden" name="name" value={joining.name} />
        <input type="hidden" name="addressLine1" value={joining.addressLine1} />
        <input type="hidden" name="area" value={joining.area} />
        <input type="hidden" name="city" value={joining.city} />
        <input type="hidden" name="state" value="Tamil Nadu" />
        <input type="hidden" name="pincode" value={joining.pincode} />

        {error && (
          <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-800">
            {error}
          </p>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-azure-700">
            Joining an existing location
          </p>
          <h3 className="mt-1 text-lg font-bold text-graphite-900">
            {joining.name}
          </h3>
          <p className="mt-0.5 text-sm text-graphite-600">
            {joining.addressLine1}, {joining.area}, {joining.city}{" "}
            {joining.pincode}
          </p>
          {joining.landmark && (
            <p className="text-sm italic text-graphite-500">{joining.landmark}</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-graphite-600">
            {joining.doctorCount === 1
              ? "One practitioner already holds hours here."
              : `${joining.doctorCount} practitioners already hold hours here.`}{" "}
            You will share the address, photographs and facilities — they are
            the building&rsquo;s, not yours — and keep your own fee, hours and
            calendar. Ask us if any of the shared details are wrong.
          </p>
        </div>

        <Text
          name="feeInr"
          label="Your consultation fee at this location (₹)"
          type="number"
          min={0}
          defaultValue="0"
          hint="Yours alone. Other practitioners here set their own."
          required
        />

        <label className="flex items-center gap-2.5 text-sm text-graphite-700">
          <input
            type="checkbox"
            name="isPrimary"
            className="h-4 w-4 rounded border-graphite-300"
          />
          This is my main location
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-azure-100 pt-4">
          <Hint text="Adds you to this clinic. It keeps the same clinic record, so clients see one place rather than two copies of it.">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary disabled:opacity-60"
            >
              {pending ? "Joining…" : "Join this location"}
            </button>
          </Hint>
          <button
            type="button"
            onClick={() => setJoining(null)}
            className="btn-ghost"
          >
            Not this one
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-5 rounded-[10px] border border-azure-200 bg-white p-5"
      onSubmit={v.guard(submit)}
    >
      {v.summary}
      <input type="hidden" name="clinicId" value={c?.id ?? ""} />

      {error && (
        <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-800">
          {error}
        </p>
      )}

      {shared && (
        <div className="rounded-xl border border-graphite-200 bg-graphite-50 px-4 py-3">
          <p className="text-sm font-bold text-graphite-800">
            This location is shared with {c!._count.doctors - 1} other
            practitioner{c!._count.doctors - 1 === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-graphite-600">
            The address, landmark, photographs and facilities belong to the
            premises rather than to any one practice, so they are read-only
            here — a change would alter them for everybody without their
            knowing. Your fee and whether this is your main location are yours
            to set. Email us if a shared detail needs correcting.
          </p>
        </div>
      )}

      <Text
        name="name"
        label="Clinic name"
        value={shared ? undefined : name}
        defaultValue={shared ? c?.name : undefined}
        onChange={shared ? undefined : (e) => setName(e.target.value)}
        readOnly={shared}
        required
      />

      {/* ── The suggestions ────────────────────────────────────────── */}
      {matches.length > 0 && (
        <MatchList
          matches={matches}
          onJoin={setJoining}
          onDismiss={() => setDismissed(true)}
        />
      )}

      <Text
        name="addressLine1"
        label="Address"
        value={shared ? undefined : address1}
        defaultValue={shared ? c?.addressLine1 : undefined}
        onChange={shared ? undefined : (e) => setAddress1(e.target.value)}
        readOnly={shared}
        required
      />
      <Text
        name="addressLine2"
        label="Address line 2"
        defaultValue={c?.addressLine2 ?? ""}
        readOnly={shared}
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
          errors={v.fields}
          onPincodeChange={shared ? undefined : setPincode}
          readOnly={shared}
        />
        <Text
          name="phone"
          label="Clinic phone"
          defaultValue={c?.phone ?? ""}
          readOnly={shared}
        />
        <Text
          name="feeInr"
          label="Consultation fee (₹)"
          type="number"
          min={0}
          defaultValue={String(existing?.feeInr ?? 0)}
          hint="Yours alone. Leave 0 to show 'on enquiry' instead of a price."
          required
        />
      </div>

      {/* ── Landmark and the map, under the address where they belong ─ */}
      {shared ? (
        c?.landmark ? (
          <div>
            <p className="text-sm font-semibold text-graphite-800">Landmark</p>
            <p className="mt-1 text-sm italic text-graphite-600">{c.landmark}</p>
          </div>
        ) : null
      ) : (
        <LocationPicker
          defaultLandmark={c?.landmark ?? ""}
          defaultLat={c?.lat ?? null}
          defaultLng={c?.lng ?? null}
          addressHint={() =>
            [address1, pincode].filter(Boolean).join(", ")
          }
        />
      )}

      {!shared && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField
              name="exteriorImage"
              label="External photos of clinic"
              defaultValue={exterior}
              folder="clinics"
              hint="A shopfront or entrance shot, so people can find you."
            />
            <ImageField
              name="interiorImage"
              label="Clinic interior photos"
              defaultValue={interior}
              folder="clinics"
              hint="Reception or a treatment room."
            />
          </div>

          <FacilityPicker
            name="facilities"
            defaultSelected={c?.facilities.map((f) => f.name) ?? []}
          />
        </>
      )}

      <label className="flex items-center gap-2.5 text-sm text-graphite-700">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={existing?.isPrimary ?? true}
          className="h-4 w-4 rounded border-graphite-300"
        />
        This is my main location
      </label>

      <div className="flex items-center gap-3 border-t border-graphite-100 pt-4">
        <Hint
          text={
            existing
              ? "Saves the changes to this location."
              : "Saves this location. You can add more afterwards, and set hours for each one on the next step."
          }
        >
          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : existing
                ? "Save changes"
                : "Add this location"}
          </button>
        </Hint>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------------------------- The suggestions ---------------------------- */

function MatchList({
  matches,
  onJoin,
  onDismiss,
}: {
  matches: MatchRow[];
  onJoin: (m: MatchRow) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-azure-200 bg-azure-50/60 p-4">
      <p className="text-sm font-bold text-azure-900">
        {matches.length === 1
          ? "This clinic may already be on BluDerma"
          : "One of these may be your clinic"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-azure-800/80">
        Joining an existing location keeps one record instead of two, so
        clients see one clinic rather than duplicates of it, and the address
        and photographs are already done. Ignore this if none of them is yours.
      </p>

      <ul className="mt-3 space-y-2">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-azure-200/70"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-graphite-900">{m.name}</p>
              <p className="text-xs text-graphite-600">
                {m.addressLine1}, {m.area}, {m.city} {m.pincode}
              </p>
              {m.landmark && (
                <p className="text-xs italic text-graphite-500">{m.landmark}</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-azure-700">
                {m.reason} ·{" "}
                {m.doctorCount === 1
                  ? "1 practitioner here"
                  : `${m.doctorCount} practitioners here`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onJoin(m)}
              className="shrink-0 rounded-full bg-azure-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700"
            >
              This is mine
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-2.5 text-xs font-semibold text-azure-700 hover:underline"
      >
        None of these — mine is a different clinic
      </button>
    </div>
  );
}

/**
 * Asks the server whether this clinic already exists, as the doctor types.
 *
 * Debounced hard at 500ms and gated on having both a name and a full PIN code,
 * because this is a search across the clinic table and the alternative is one
 * query per keystroke of a name. The last response wins: a fast reply to an
 * early query must not overwrite the answer to a later one, which is what the
 * sequence counter is for.
 */
function useClinicMatches({
  name,
  addressLine1,
  pincode,
  excludeId,
  enabled,
  onResult,
}: {
  name: string;
  addressLine1: string;
  pincode: string;
  excludeId: string;
  enabled: boolean;
  onResult: (rows: MatchRow[]) => void;
}) {
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled || name.trim().length < 3 || !/^\d{6}$/.test(pincode.trim())) {
      onResult([]);
      return;
    }

    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/clinics/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            addressLine1: addressLine1.trim(),
            pincode: pincode.trim(),
            excludeId,
          }),
        });
        const data = await res.json();
        if (seq.current !== mine) return;
        onResult(res.ok && data?.ok ? (data.matches as MatchRow[]) : []);
      } catch {
        // A failed lookup is a missing convenience, never a blocked form.
        if (seq.current === mine) onResult([]);
      }
    }, 500);

    return () => window.clearTimeout(timer);
    // onResult is a setState function and stable; listing it would re-run this
    // on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, addressLine1, pincode, excludeId, enabled]);
}

/* ------------------------------- Field ----------------------------------- */

function Text({
  name,
  label,
  hint,
  error,
  readOnly,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-semibold text-graphite-800"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-graphite-900 outline-none transition focus:ring-4 ${
          readOnly
            ? "border-graphite-200 bg-graphite-50 text-graphite-500"
            : error
              ? "border-coral-300 bg-white focus:border-coral-400 focus:ring-coral-500/15"
              : "border-graphite-200 bg-white focus:border-azure-400 focus:ring-azure-500/15"
        }`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-sm text-coral-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-graphite-500">{hint}</p>
      ) : null}
    </div>
  );
}
