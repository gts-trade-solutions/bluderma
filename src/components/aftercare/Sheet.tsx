import { AlertTriangle, Check, X } from "lucide-react";

export interface SheetData {
  id: string;
  patientName: string;
  patientPublicId: string | null;
  doctorName: string;
  doctorPublicId: string | null;
  clinicName: string | null;
  clinicContact: string | null;
  procedure: string;
  procedureDate: Date;
  reviewOn: Date | null;
  intro: string;
  dos: string[];
  donts: string[];
  warnings: string[];
  doctorNotes: string | null;
  emergencyContact: string | null;
  issuedAt: Date;
  acknowledgedAt: Date | null;
}

const fmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/**
 * The aftercare sheet as a document.
 *
 * ── Light, deliberately, on both sides ───────────────────────────────────
 * Every colour here is a literal. This renders inside the doctor portal
 * (light) AND inside the client profile (dark), and it is a document either
 * way: something to read, print and hold. `text-ink` resolves to a near-white
 * outside `.theme-light`, so a token would make half of it invisible on the
 * client side. A printed page is white; so is this.
 *
 * ── Reading order ────────────────────────────────────────────────────────
 * Warning signs come BEFORE the do's and don'ts, which is not how the source
 * document orders them. On paper a reader takes in the whole page; on a phone
 * they take in the first screen. The one section where being late matters is
 * the one that says when to call the clinic.
 */
export default function AftercareSheetView({ sheet }: { sheet: SheetData }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-8 print:shadow-none print:ring-0">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">
          {sheet.clinicName ?? "BluDerma"}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900 sm:text-3xl">
          Post-procedure aftercare instructions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Invasive and barrier-disrupting dermatological procedures
        </p>
      </header>

      <dl className="grid gap-x-6 gap-y-3.5 border-b border-slate-200 py-5 sm:grid-cols-2">
        <Row label="Patient" value={sheet.patientName} id={sheet.patientPublicId} />
        <Row label="Procedure" value={sheet.procedure} />
        <Row label="Date of procedure" value={fmt(sheet.procedureDate)} />
        <Row
          label="Review / next visit"
          value={sheet.reviewOn ? fmt(sheet.reviewOn) : "Not scheduled"}
        />
        <Row
          label="Treating doctor"
          value={sheet.doctorName}
          id={sheet.doctorPublicId}
        />
        <Row label="Issued" value={fmt(sheet.issuedAt)} />
      </dl>

      <p className="py-5 text-[15px] leading-relaxed text-slate-700">{sheet.intro}</p>

      {/* First, because on a phone this is the section that must not be
          scrolled past. */}
      <section className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-rose-800">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Contact the clinic immediately if you notice
        </h2>
        <ul className="mt-3 space-y-2">
          {sheet.warnings.map((w) => (
            <li key={w} className="flex gap-2.5 text-sm leading-relaxed text-rose-900">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
              {w}
            </li>
          ))}
        </ul>
        {(sheet.emergencyContact ?? sheet.clinicContact) && (
          <p className="mt-3.5 border-t border-rose-200 pt-3 text-sm font-bold text-rose-900">
            Emergency contact: {sheet.emergencyContact ?? sheet.clinicContact}
          </p>
        )}
      </section>

      {/* The doctor's own words sit above the standard lists, because the
          sheet says they override them. Putting them at the foot, as the
          source document does, buries the one part written for this patient
          under twenty-two lines that were not. */}
      {sheet.doctorNotes && (
        <section className="mt-5 rounded-xl border-2 border-brand-300 bg-brand-50 p-4 sm:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-brand-800">
            From {sheet.doctorName}, for you
          </h2>
          <p className="mt-1 text-xs text-brand-700">
            Specific to you, and overrides the standard list below.
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {sheet.doctorNotes}
          </p>
        </section>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <List
          title="Please do"
          items={sheet.dos}
          tone="teal"
          Icon={Check}
        />
        <List
          title="Please avoid"
          items={sheet.donts}
          tone="slate"
          Icon={X}
        />
      </div>

      <footer className="mt-6 border-t border-slate-200 pt-5">
        {sheet.acknowledgedAt ? (
          <p className="text-sm text-slate-600">
            <span className="font-bold text-teal-700">Confirmed</span> on{" "}
            {fmt(sheet.acknowledgedAt)}: the instructions were explained and there
            was an opportunity to ask questions.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Not yet confirmed by the patient.
          </p>
        )}
      </footer>
    </article>
  );
}

function Row({
  label,
  value,
  id,
}: {
  label: string;
  value: string;
  id?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">
        {value}
        {id && (
          <span className="ml-2 select-all font-mono text-xs font-bold tracking-wide text-slate-400">
            {id}
          </span>
        )}
      </dd>
    </div>
  );
}

function List({
  title,
  items,
  tone,
  Icon,
}: {
  title: string;
  items: string[];
  tone: "teal" | "slate";
  Icon: typeof Check;
}) {
  // Full literal strings: Tailwind scans source text, so an interpolated class
  // compiles to nothing and the colour silently goes missing.
  const skin =
    tone === "teal"
      ? { head: "text-teal-800", dot: "text-teal-600", ring: "ring-teal-200", bg: "bg-teal-50/60" }
      : { head: "text-slate-800", dot: "text-slate-500", ring: "ring-slate-200", bg: "bg-slate-50" };

  return (
    <section className={`rounded-xl p-4 ring-1 ring-inset sm:p-5 ${skin.ring} ${skin.bg}`}>
      <h2 className={`text-sm font-extrabold uppercase tracking-wide ${skin.head}`}>
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
            <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${skin.dot}`} strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
