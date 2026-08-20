/**
 * A look at the thing they would actually be using.
 *
 * The calendar is drawn in markup rather than screenshotted: a screenshot goes
 * stale the first time the portal changes, renders badly on a phone, and is
 * invisible to a text crawler. This is a small honest sketch of the real
 * layout — same clinic colours, same week grid — labelled as an illustration
 * so nobody mistakes it for live data.
 */

const CLINICS = [
  { name: "Nungambakkam", dot: "bg-blue-500", chip: "bg-blue-50 border-blue-200 text-blue-900" },
  { name: "Adyar", dot: "bg-teal-500", chip: "bg-teal-50 border-teal-200 text-teal-900" },
  { name: "Anna Nagar", dot: "bg-violet-500", chip: "bg-violet-50 border-violet-200 text-violet-900" },
];

/** Deliberately not a full week — enough to read the idea at a glance. */
const WEEK = [
  { day: "Mon", blocks: [{ t: "09:30", who: "R. Prasad", c: 0 }, { t: "17:00", who: "S. Iyer", c: 1 }] },
  { day: "Tue", blocks: [{ t: "10:00", who: "A. Khan", c: 2 }] },
  { day: "Wed", blocks: [{ t: "09:30", who: "M. Rao", c: 0 }, { t: "17:30", who: "J. Thomas", c: 1 }] },
  { day: "Thu", blocks: [{ t: "10:20", who: "N. Balan", c: 2 }] },
  { day: "Fri", blocks: [{ t: "11:00", who: "P. Menon", c: 0 }] },
];

export default function PortalPreview() {
  return (
    <section className="scroll-mt-24 py-20" id="portal">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="section-eyebrow">Your portal</p>
            <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
              One week. Every clinic. One place to act on it.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              If you consult at three locations, you currently keep three
              diaries and reconcile them in your head. Here they are one grid,
              colour-coded, and the system refuses to book you into two places
              at once — including the drive between them.
            </p>

            <ul className="mt-8 space-y-4">
              <Feature
                title="Click any booking"
                body="Their skin analysis, questionnaire answers, contact details and every appointment they have had with you — in a panel, without leaving the week."
              />
              <Feature
                title="Confirm, move or cancel from there"
                body="Moving a booking emails the client the new time automatically, and does not use up their own reschedule allowance. Cancelling never charges them a fee."
              />
              <Feature
                title="Prescribe after the consultation"
                body="File it against the appointment and it lands in the client's record, where they can read it back later."
              />
            </ul>
          </div>

          {/* ── The sketch ─────────────────────────────────────────── */}
          <figure>
            {/* The mock stays white because the portal it depicts is white.
                Recolouring it dark to match this page would be a lie about the
                product. The frame and the shadow are what make it read as a
                screenshot of something else rather than a panel of this page —
                and every colour inside it is a literal slate value, because
                `text-ink` here would resolve to the DARK theme's near-white. */}
            <div className="overflow-hidden rounded-2xl bg-white p-1 shadow-[0_30px_70px_-24px_rgba(2,10,28,0.85)] ring-1 ring-white/15">
            <div className="overflow-hidden rounded-[0.85rem] border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  All locations
                </span>
                {CLINICS.map((c) => (
                  <span
                    key={c.name}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  >
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    {c.name}
                  </span>
                ))}
              </div>

              {/* Five day-columns cannot fit a phone at a readable width, so
                  the week scrolls inside its own box rather than squeezing. */}
              <div className="-mx-px overflow-x-auto">
              <div className="grid min-w-[520px] grid-cols-5 divide-x divide-slate-100">
                {WEEK.map((d) => (
                  <div key={d.day} className="min-h-[168px] p-2">
                    <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {d.day}
                    </p>
                    <div className="space-y-1.5">
                      {d.blocks.map((b) => (
                        <div
                          key={b.t}
                          className={`rounded-md border border-l-[3px] px-1.5 py-1 ${CLINICS[b.c].chip}`}
                        >
                          <p className="text-[10px] font-bold tabular-nums">{b.t}</p>
                          <p className="truncate text-[10px] leading-tight">{b.who}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>

              <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                  2
                </span>
                <p className="text-xs font-semibold text-amber-900">
                  Two bookings waiting for you to confirm — their slots are held
                  until you do.
                </p>
              </div>
            </div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-ink-muted">
              An illustration of the calendar layout. Names and times are made up.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
      <div>
        <h3 className="font-bold text-ink">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{body}</p>
      </div>
    </li>
  );
}
