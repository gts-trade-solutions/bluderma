import { CLINIC_TIERS, type ClinicPerfSummary } from "@/lib/doctor/financeCore";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Each location's month, strongest first.
 *
 * ── Why the ordering is the point ────────────────────────────────────────
 * A doctor working three clinics had one revenue figure covering all three,
 * which answers none of the questions they use it for: where the extra
 * session should go, which rent is worth paying, which location is quietly
 * running at a loss. The rank is not decoration on a table — it IS the
 * finding.
 *
 * ── Colour, and why it is not a mood ─────────────────────────────────────
 * Blue is best, exactly as it is on the machines above, so the two tables can
 * be read with the same eye. But the tier is not simply "rank 1 is blue":
 * anything spending more than it takes goes rose no matter where it placed,
 * because a clinic can come second on revenue and still be the one thing on
 * this page worth acting on. Colour tracks the decision, not the position.
 *
 * ── The bar is share, and it is a real one ───────────────────────────────
 * Each bar is that clinic's share of revenue that could be placed by
 * location, so the bars across all rows total one whole. It excludes the
 * dispensary, which is stated underneath rather than quietly folded in — see
 * clinicPerformanceFor(), which refuses to invent an attribution for it.
 */
export default function ClinicPerformance({ perf }: { perf: ClinicPerfSummary }) {
  if (perf.rows.length === 0) {
    return (
      <div className="px-4 py-6 text-center sm:px-5">
        <p className="text-sm font-semibold text-graphite-700">No locations yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-graphite-500">
          Add the places you practise from and this splits your month across
          them — takings, running costs and what each one actually clears.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-graphite-100">
        {perf.rows.map((r) => {
          const meta = CLINIC_TIERS[r.tier];
          // Full literal strings: Tailwind scans source text, so an
          // interpolated class compiles to nothing and the colour goes
          // missing without anything failing.
          const skin = {
            blue: {
              edge: "border-l-azure-500",
              pill: "bg-azure-100 text-azure-900",
              bar: "bg-azure-500",
            },
            teal: {
              edge: "border-l-mint-500",
              pill: "bg-mint-100 text-mint-900",
              bar: "bg-mint-500",
            },
            amber: {
              edge: "border-l-gold-500",
              pill: "bg-gold-100 text-gold-900",
              bar: "bg-gold-500",
            },
            rose: {
              edge: "border-l-coral-500",
              pill: "bg-coral-100 text-coral-900",
              bar: "bg-coral-500",
            },
            slate: {
              edge: "border-l-graphite-300",
              pill: "bg-graphite-100 text-graphite-600",
              bar: "bg-graphite-400",
            },
          }[meta.tone];

          return (
            <li
              key={r.clinicId}
              className={`border-l-[3px] px-4 py-4 sm:px-5 ${skin.edge}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-graphite-100 text-[11px] font-black tabular-nums text-graphite-600">
                      {r.rank}
                    </span>
                    <p className="truncate text-sm font-bold text-graphite-900">
                      {r.name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${skin.pill}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-graphite-500">
                    {r.meaning}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-display text-[19px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-graphite-900">
                    {money(r.revenueInr)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold tabular-nums text-graphite-500">
                    {pct(r.sharePct)} of placed takings
                  </p>
                </div>
              </div>

              {/* Share of everything that could be placed by location. */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-graphite-100">
                <div
                  className={`h-full rounded-full ${skin.bar}`}
                  style={{ width: `${Math.max(r.sharePct * 100, r.revenueInr > 0 ? 3 : 0)}%` }}
                />
              </div>

              {/* The detail. Three streams in, running costs out, and what
                  is left — which is the figure the rank cannot show. */}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                <Stat
                  label="Bookings"
                  value={money(r.bookingsInr)}
                  hint={`${r.bookingCount} visit${r.bookingCount === 1 ? "" : "s"}`}
                />
                <Stat
                  label="Equipment"
                  value={money(r.proceduresInr)}
                  hint={`${r.procedureCount} use${r.procedureCount === 1 ? "" : "s"}`}
                />
                <Stat label="Other income" value={money(r.otherInr)} />
                <Stat
                  label="Running costs"
                  value={money(r.costsInr)}
                  hint="Capital is not in this"
                />
              </dl>

              <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-graphite-100 pt-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-graphite-500">
                  Clears
                </span>
                <span
                  className={`font-display text-[15px] font-extrabold tabular-nums ${
                    r.netInr < 0 ? "text-coral-600" : "text-graphite-900"
                  }`}
                >
                  {money(r.netInr)}
                  {r.marginPct !== null && (
                    <span className="ml-1.5 text-[11px] font-bold text-graphite-500">
                      {pct(r.marginPct)} margin
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* What is deliberately NOT in the ranking. Stated here rather than
          folded in, because a split figure that was actually a guess would
          make every comparison above unsafe to act on. */}
      <div className="space-y-1.5 border-t border-graphite-100 bg-graphite-50/60 px-4 py-3.5 sm:px-5">
        {perf.unattributableInr > 0 && (
          <Aside
            label="Dispensary"
            value={money(perf.unattributableInr)}
            body="Medicine orders belong to the practice, not to a room. Left out of the split rather than divided by a guess."
          />
        )}
        {perf.unplacedInr > 0 && (
          <Aside
            label="No location set"
            value={money(perf.unplacedInr)}
            body="Takings on rows with no clinic against them. Set one and they join the ranking."
          />
        )}
        {perf.unplacedCostsInr > 0 && (
          <Aside
            label="Costs with no location"
            value={money(perf.unplacedCostsInr)}
            body="Running costs not booked to a clinic, so they are missing from every margin above."
          />
        )}
        {perf.singleClinic && (
          <p className="text-[11px] leading-relaxed text-graphite-500">
            One location, so there is nothing to rank against — the breakdown
            still shows where the month came from.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-graphite-500">
        {label}
      </dt>
      <dd className="text-[13px] font-bold tabular-nums text-graphite-700">{value}</dd>
      {hint && <dd className="text-[10px] leading-tight text-graphite-500">{hint}</dd>}
    </div>
  );
}

function Aside({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <p className="text-[11px] leading-relaxed text-graphite-500">
      <span className="font-bold text-graphite-600">{label}</span>
      <span className="mx-1.5 font-bold tabular-nums text-graphite-700">{value}</span>
      — {body}
    </p>
  );
}
