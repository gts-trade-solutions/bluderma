import Link from "next/link";

import { Tag } from "./portalUi";

/**
 * Who this patient is, beside the plan being written for them.
 *
 * ── Why ──────────────────────────────────────────────────────────────────
 * The treatment plan screen showed a name, a list of suggested lines and two
 * buttons. Nothing about the person: not their age, not what they came in for,
 * not what they are allergic to, not what this practice has already given
 * them, not whether they turn up. A doctor cannot plan a course of treatment
 * from a name — and asking them to open the patient record in another tab to
 * find out is the same as not showing it.
 *
 * ── What is on it, and why each thing earns its place ────────────────────
 *   IDENTITY   Age and sex change what you would offer, and the id is what
 *              gets quoted on paper.
 *   ALLERGIES  The one fact on this panel that can hurt somebody. Printed
 *              whether or not there are any, because a blank line reads as
 *              "not asked" and it always is asked.
 *   MEDICATION What they are already taking, for interactions.
 *   THE VISITS How many, how recent, whether one is booked. A plan for
 *              somebody who has not been in for a year is a different plan.
 *   RELIABILITY Cancellations and no-shows, shown only once there are enough
 *              visits to mean anything — a six-session course proposed to
 *              somebody who misses half their appointments is worth knowing
 *              about before it is proposed, not after.
 *   ALREADY GIVEN The last prescriptions and care sheets, so a plan does not
 *              silently repeat or contradict what is already in flight.
 *
 * Everything here is scoped to this practice. Another clinic's history is
 * theirs, which is the same line the chart and the drawer draw.
 */

export interface PatientBriefData {
  userId: string;
  name: string;
  publicId: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  phone: string | null;
  /** Snapshotted from their most recent booking with this practice. */
  allergies: string | null;
  medications: string | null;
  reason: string | null;
  visits: number;
  completed: number;
  cancelled: number;
  noShows: number;
  lastVisit: string | null;
  nextVisit: string | null;
  concerns: { label: string; score: number | null; band: string | null }[];
  analysedOn: string | null;
  prescriptions: { id: string; title: string; on: string; lines: string[] }[];
  sheets: { id: string; kind: string; procedure: string; on: string }[];
  otherPlans: { id: string; on: string; shared: boolean; accepted: number }[];
}

export default function PatientBrief({
  brief,
  /** Omitted on the patient's own record, where linking to it is a loop. */
  showRecordLink = true,
}: {
  brief: PatientBriefData;
  showRecordLink?: boolean;
}) {
  const enoughVisits = brief.completed + brief.cancelled + brief.noShows >= 5;
  const missed = brief.cancelled + brief.noShows;

  return (
    <div className="space-y-4">
      {/* ── Who ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-portal text-[17px] font-extrabold tracking-[-0.02em] text-graphite-900">
            {brief.name}
          </p>
          {brief.publicId && (
            <span className="select-all font-mono text-[11px] font-semibold tracking-wide text-graphite-500">
              {brief.publicId}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-graphite-600">
          {[
            brief.age !== null ? `${brief.age} years` : null,
            brief.gender && brief.gender !== "UNDISCLOSED"
              ? brief.gender.toLowerCase()
              : null,
            brief.city,
            brief.phone,
          ]
            .filter(Boolean)
            .join(" · ") || "No profile details recorded"}
        </p>
        {showRecordLink && (
          <Link
            href={`/doctor/portal/patients/${brief.userId}`}
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-azure-700 underline-offset-2 hover:underline"
          >
            Open their full record →
          </Link>
        )}
      </div>

      {/* ── The two facts that change what you may prescribe ──────────── */}
      <dl className="grid gap-2 rounded-lg bg-graphite-50 p-3 text-[13px]">
        <Fact label="Allergies">
          {brief.allergies ? (
            <span className="font-bold text-coral-700">{brief.allergies}</span>
          ) : (
            <span className="text-graphite-600">None reported</span>
          )}
        </Fact>
        <Fact label="Medication">
          {brief.medications || (
            <span className="text-graphite-600">None reported</span>
          )}
        </Fact>
        {brief.reason && <Fact label="Came in for">{brief.reason}</Fact>}
      </dl>

      {/* ── How they use the practice ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Visits" value={String(brief.visits)} hint="with you" />
        <Stat
          label="Last seen"
          value={brief.lastVisit ?? "—"}
          hint={brief.lastVisit ? "" : "never"}
        />
        <Stat
          label="Next"
          value={brief.nextVisit ?? "—"}
          hint={brief.nextVisit ? "" : "nothing booked"}
        />
      </div>

      {enoughVisits && missed > 0 && (
        <p className="rounded-lg border-l-4 border-l-gold-500 border border-gold-200 bg-gold-50 px-3 py-2 text-[12px] font-semibold text-graphite-900">
          {missed} of their {brief.visits} bookings did not happen
          {brief.noShows > 0 ? ` (${brief.noShows} without notice)` : ""}. Worth
          knowing before proposing a course of several sessions.
        </p>
      )}

      {/* ── What the analysis found ───────────────────────────────────── */}
      {brief.concerns.length > 0 && (
        <Block title={`Their analysis${brief.analysedOn ? ` · ${brief.analysedOn}` : ""}`}>
          <ul className="space-y-1.5">
            {brief.concerns.map((c) => (
              <li key={c.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] capitalize text-graphite-700">
                    {c.label}
                  </span>
                  <span className="text-[12px] font-bold text-graphite-900">
                    {c.band ?? (c.score !== null ? Math.round(c.score) : "—")}
                  </span>
                </div>
                {c.score !== null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite-100">
                    <div
                      className="h-full rounded-full bg-azure-500"
                      style={{ width: `${Math.min(Math.max(c.score, 0), 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ── What they already have ────────────────────────────────────── */}
      {brief.prescriptions.length > 0 && (
        <Block title="Already prescribed">
          <ul className="space-y-2">
            {brief.prescriptions.map((p) => (
              <li key={p.id}>
                <p className="text-[13px] font-bold text-graphite-900">{p.title}</p>
                <p className="text-[11px] text-graphite-600">
                  {p.on}
                  {p.lines.length > 0 ? ` · ${p.lines.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {brief.sheets.length > 0 && (
        <Block title="Care sheets sent">
          <ul className="space-y-1.5">
            {brief.sheets.map((sheet) => (
              <li key={sheet.id} className="flex items-center gap-2 text-[12px]">
                <Tag tone={sheet.kind === "PRE" ? "brand" : "teal"}>
                  {sheet.kind === "PRE" ? "Before" : "After"}
                </Tag>
                <span className="min-w-0 flex-1 truncate text-graphite-800">
                  {sheet.procedure}
                </span>
                <span className="shrink-0 text-graphite-500">{sheet.on}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {brief.otherPlans.length > 0 && (
        <Block title="Their other programs">
          <ul className="space-y-1.5">
            {brief.otherPlans.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[12px]">
                <Link
                  href={`/doctor/portal/plans/${p.id}`}
                  className="min-w-0 flex-1 truncate font-semibold text-azure-700 underline-offset-2 hover:underline"
                >
                  {p.accepted} treatment{p.accepted === 1 ? "" : "s"} · {p.on}
                </Link>
                <Tag tone={p.shared ? "teal" : "amber"}>
                  {p.shared ? "Shared" : "Draft"}
                </Tag>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-2">
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-graphite-500">
        {label}
      </dt>
      <dd className="text-graphite-800">{children}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-graphite-200 bg-white px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-graphite-500">
        {label}
      </p>
      <p className="mt-0.5 font-portal text-[13px] font-extrabold leading-tight text-graphite-900">
        {value}
      </p>
      {hint && <p className="text-[10px] text-graphite-500">{hint}</p>}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 border-b border-graphite-200 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-600">
        <span aria-hidden className="h-3 w-[3px] rounded-full bg-gold-500" />
        {title}
      </p>
      {children}
    </div>
  );
}
