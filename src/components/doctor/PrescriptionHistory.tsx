import Link from "next/link";

import { Tag } from "./portalUi";

/**
 * Everything this practice has prescribed, by patient, over a chosen window.
 *
 * ── Why it exists ────────────────────────────────────────────────────────
 * The Prescriptions screen listed the dispensary and the orders placed
 * against it, which are the practice's stock and the practice's sales. What
 * it could not answer was the clinical question: what did I actually give
 * this person, and when. A doctor asked that on every follow-up and had to
 * open the patient's chart one appointment at a time to find out.
 *
 * ── The money line ───────────────────────────────────────────────────────
 * Each line that was picked off the practice's own shelf carries that
 * medicine's price, so a prescription has a value: what it is worth if the
 * patient fills it here rather than at a chemist. That is a potential, not a
 * takings figure, and it is labelled as one — the realised half is the orders
 * panel above, and conflating the two would overstate a month's income by
 * everything a patient chose to buy elsewhere.
 *
 * Freehand lines are priced at nothing on purpose. A dermatologist writes
 * mostly things they do not stock, and guessing a market price for those
 * would inflate the figure with money this practice was never going to see.
 */

export interface PrescriptionRow {
  id: string;
  title: string;
  notes: string | null;
  issuedAt: Date;
  patientName: string;
  patientPublicId: string | null;
  patientUserId: string;
  items: {
    id: string;
    name: string;
    strength: string | null;
    form: string | null;
    dose: string | null;
    duration: string | null;
    /** Null for a freehand line, or a medicine since delisted. */
    priceInr: number | null;
  }[];
}

export const PRESCRIPTION_WINDOWS = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "Everything", days: -1 },
] as const;

export type PrescriptionWindow = (typeof PRESCRIPTION_WINDOWS)[number]["key"];

export function parseWindow(raw: unknown): PrescriptionWindow {
  return PRESCRIPTION_WINDOWS.some((w) => w.key === raw)
    ? (raw as PrescriptionWindow)
    : "30d";
}

/** Midnight, clinic wall clock, `days` ago. -1 means no floor at all. */
export function windowStart(w: PrescriptionWindow): Date | null {
  const days = PRESCRIPTION_WINDOWS.find((x) => x.key === w)?.days ?? 30;
  if (days < 0) return null;
  // +5:30 for the same reason everything else in this app shifts: clinic
  // wall-clock time is stored labelled as UTC. See queries/availability.ts.
  const now = new Date(Date.now() + 330 * 60_000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight - days * 86_400_000);
}

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function whenLabel(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function valueOfPrescription(row: PrescriptionRow): number {
  return row.items.reduce((sum, i) => sum + (i.priceInr ?? 0), 0);
}

export default function PrescriptionHistory({
  rows,
  active,
}: {
  rows: PrescriptionRow[];
  active: PrescriptionWindow;
}) {
  const items = rows.reduce((n, r) => n + r.items.length, 0);
  const fromShelf = rows.reduce(
    (n, r) => n + r.items.filter((i) => i.priceInr !== null).length,
    0
  );
  const value = rows.reduce((n, r) => n + valueOfPrescription(r), 0);
  const patients = new Set(rows.map((r) => r.patientUserId)).size;

  return (
    <div>
      {/* ── The window ───────────────────────────────────────────────
          Links rather than a control: the page is server-rendered, the
          window is in the URL, and a particular fortnight is therefore a
          link a doctor can keep. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {PRESCRIPTION_WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`/doctor/portal/medicines?since=${w.key}#written`}
            scroll={false}
            aria-current={active === w.key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
              active === w.key
                ? "bg-graphite-900 text-white"
                : "bg-graphite-100 text-graphite-700 hover:bg-graphite-200"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </div>

      {/* ── What the window adds up to ──────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Figure label="Prescriptions" value={String(rows.length)} hint={`${patients} patient${patients === 1 ? "" : "s"}`} tone="azure" />
        <Figure label="Lines written" value={String(items)} hint={`${fromShelf} from your own shelf`} tone="mint" />
        <Figure
          label="Value from your shelf"
          value={money(value)}
          hint="If these are filled here"
          tone="gold"
        />
        <Figure
          label="Written elsewhere"
          value={String(items - fromShelf)}
          hint="Lines you do not stock"
          tone="graphite"
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-graphite-300 bg-white px-5 py-10 text-center text-sm text-graphite-600">
          Nothing prescribed in this window. Write one from a booking in Today
          or Calendar and it appears here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const worth = valueOfPrescription(r);
            return (
              <li
                key={r.id}
                className="rounded-[10px] border border-graphite-200 bg-white p-3.5 shadow-flat sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {/* The patient's name is the heading. This list is read
                          to answer "what did I give THEM", so the person is
                          the subject and the medicine is the detail. */}
                      <Link
                        href={`/doctor/portal/patients/${r.patientUserId}`}
                        className="font-portal text-[15px] font-bold text-graphite-900 underline-offset-2 hover:text-azure-700 hover:underline"
                      >
                        {r.patientName}
                      </Link>
                      {r.patientPublicId && (
                        <span className="select-all font-mono text-[11px] font-semibold tracking-wide text-graphite-500">
                          {r.patientPublicId}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-graphite-600">
                      <span className="font-semibold text-graphite-800">{r.title}</span>
                      {" · "}
                      {whenLabel(r.issuedAt)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-portal text-[15px] font-extrabold tabular-nums text-graphite-900">
                      {worth > 0 ? money(worth) : "—"}
                    </p>
                    <p className="text-[11px] font-semibold text-graphite-500">
                      {worth > 0 ? "from your shelf" : "nothing you stock"}
                    </p>
                  </div>
                </div>

                <ul className="mt-2.5 space-y-1.5 border-t border-graphite-100 pt-2.5">
                  {r.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]"
                    >
                      <span className="font-bold text-graphite-900">{i.name}</span>
                      {i.strength && (
                        <span className="font-semibold text-graphite-600">{i.strength}</span>
                      )}
                      {i.form && <Tag tone="slate">{i.form}</Tag>}
                      {i.priceInr !== null ? (
                        <Tag tone="amber">{money(i.priceInr)}</Tag>
                      ) : (
                        <Tag tone="slate">not stocked</Tag>
                      )}
                      {(i.dose || i.duration) && (
                        <span className="text-graphite-600">
                          {[i.dose, i.duration].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {r.notes && (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-graphite-50 px-3 py-2 text-[12.5px] leading-relaxed text-graphite-700">
                    {r.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "azure" | "mint" | "gold" | "graphite";
}) {
  const edge = {
    azure: "bg-azure-500",
    mint: "bg-mint-500",
    gold: "bg-gold-500",
    graphite: "bg-graphite-400",
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-graphite-200 bg-white p-3 shadow-flat">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">
        {label}
      </p>
      <p className="mt-1 font-portal text-[20px] font-extrabold leading-none tabular-nums text-graphite-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-graphite-600">{hint}</p>
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[3px] ${edge}`} />
    </div>
  );
}
