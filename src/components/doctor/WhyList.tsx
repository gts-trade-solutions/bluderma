import { VisitReason } from "@prisma/client";

import SmartImage from "@/components/SmartImage";
import { DOCTOR_IMG } from "@/data/doctorImages";

/**
 * What listing actually gets a practitioner.
 *
 * This replaced six identical text boxes in a 3×2 grid. The problem was not
 * the copy — it was that every claim was pitched at the same weight, in the
 * same box, with nothing to look at, so the eye slid off the whole block. Two
 * of those six also restated proof the hero directly above had already made
 * ("no commission", "verified"), which is how a page teaches you to stop
 * reading it.
 *
 * So this is a bento: one thing said loudly and *shown*, two said clearly, and
 * the rest said briefly. The loud one is the appointment brief, because it is
 * the single feature no competitor of ours has — a clinician sees the case
 * before they see the person — and it is the only one that can be drawn rather
 * than described.
 *
 * It carries no call to action of its own. SimpleSteps sits directly beneath
 * it with one, and "free to list, ten minutes, saves as you go" appearing
 * twice within a screen of itself is how a claim stops being read.
 *
 * ── Every figure here is derived, not written ────────────────────────────
 * `INTAKE_FIELDS` is the real list of columns the booking form fills on
 * `Appointment`, and the reason count comes from the `VisitReason` enum
 * itself, so adding a thirteenth reason updates this page rather than making
 * it wrong. The example brief is labelled as an example, in the same spirit as
 * PortalPreview's calendar sketch — an illustration nobody can mistake for a
 * real patient.
 */

/** Counted from the enum, so the number cannot drift away from the form. */
const REASON_COUNT = Object.keys(VisitReason).length;

/**
 * What the booking form captures, in the order the doctor reads it.
 * One entry per real column on `Appointment` — see the intake block in
 * prisma/schema.prisma.
 */
const INTAKE_FIELDS = [
  "Presenting concern",
  "In their own words",
  "How long",
  "Severity 1–5",
  "What they've already tried",
  "Medication",
  "Allergies",
  "First visit or not",
  "Age and sex",
  "Photo consent",
];

export default function WhyList() {
  return (
    <section className="scroll-mt-24 py-20" id="why">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="section-eyebrow">Why list with us</p>
          <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
            The consultation starts before they sit down
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Most platforms sell you impressions. This one hands you a prepared
            patient and a brief you have already read.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {/* ── The one worth showing ──────────────────────────────── */}
          <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-900 to-teal-800 p-6 ring-1 ring-inset ring-white/15 sm:p-8 lg:col-span-7 lg:row-span-2">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl"
            />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-200">
                Before the door opens
              </p>
              <h3 className="display-sm mt-2 max-w-md text-2xl leading-snug text-white sm:text-[1.75rem]">
                You read the case, not just the name and a time
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                Every booking arrives with a structured history the client
                filled in themselves: {REASON_COUNT} presenting concerns to
                choose from, plus their own description, and their skin
                analysis attached where they have run one.
              </p>

              <ExampleBrief />

              <ul className="mt-5 flex flex-wrap gap-1.5">
                {INTAKE_FIELDS.map((f) => (
                  <li
                    key={f}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 ring-1 ring-inset ring-white/10"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {/* ── One calendar ───────────────────────────────────────── */}
          <article className="group rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-brand-300/40 lg:col-span-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="display-sm text-lg text-ink">
                  Three clinics, one week
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  A booking anywhere blocks that time everywhere, because you
                  can only be in one place, and we block the drive between
                  them too.
                </p>
              </div>
              <WeekSketch />
            </div>
          </article>

          {/* ── The fee ────────────────────────────────────────────── */}
          <article className="flex items-center gap-5 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-teal-300/40 lg:col-span-5">
            <p className="display shrink-0 bg-gradient-to-br from-teal-200 to-teal-400 bg-clip-text text-5xl text-transparent sm:text-6xl">
              0%
            </p>
            <div className="min-w-0">
              <h3 className="display-sm text-lg text-ink">
                Commission on your fee
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                Your fee is your fee, set per location. We never take a cut of
                it and never mark it up on the way through.
              </p>
            </div>
          </article>

          {/* ── A photograph, because seven text tiles is a wall ────── */}
          {/* The bento was entirely typographic and the client's note was
              that the page has no imagery. This is also the only tile that
              can show the thing being described: a consultation where the
              reading has already been done. */}
          <article className="group relative col-span-full overflow-hidden rounded-3xl ring-1 ring-white/10 lg:col-span-4 lg:row-span-1">
            <div className="relative h-56 lg:h-full lg:min-h-[15rem]">
              <SmartImage
                src={DOCTOR_IMG.briefingTablet}
                alt="A dermatologist examining a client's skin at the clinic"
                mode="fill"
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-[#04101f] via-[#04101f]/40 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-300">
                  In the room
                </p>
                <p className="mt-1.5 text-[15px] font-bold leading-snug text-white">
                  You spend the consultation treating, not interviewing.
                </p>
              </div>
            </div>
          </article>

          {/* ── The three quiet ones ───────────────────────────────── */}
          <Small
            glyph="shield"
            title="Verified means something"
            body="We check your registration against your council's own register before you go live. Two days, not two minutes, which is the point."
          />
          <Small
            glyph="target"
            title="Matched on what you treat"
            body="Recommendations come from the client's own analysis against the concerns you listed. Never from who paid most for placement."
          />
          <Small
            glyph="rx"
            title="Prescribe into their record"
            body="File it against the appointment and it lands in the client's file, where they can read it back weeks later."
          />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

/**
 * A miniature of the brief that actually arrives on an appointment.
 *
 * Drawn in markup rather than screenshotted for the same reasons as
 * PortalPreview's calendar: a screenshot goes stale, renders badly on a phone
 * and is invisible to a crawler. Labelled as an example, because it describes
 * a person who does not exist.
 */
function ExampleBrief() {
  return (
    <figure className="mt-6 rounded-2xl bg-[#04101f]/55 p-4 ring-1 ring-inset ring-white/10">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-teal-200 ring-1 ring-inset ring-white/15">
          MP
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-bold text-white">Meghna P.</p>
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              White Collar
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-white/50">
            Thu 10:30 · Nungambakkam · first visit
          </p>
        </div>
        {/* The scan score, as the drawer shows it. */}
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold leading-none text-teal-300">
            68
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">
            skin score
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>Acne or breakouts</Chip>
        <Chip>6–12 months</Chip>
        <Chip>Severity 4/5</Chip>
      </div>

      <p className="mt-3 border-l-2 border-teal-400/50 pl-3 text-[13px] leading-relaxed text-white/70">
        “Breakouts along the jaw that flare the week before my period. Tried a
        benzoyl peroxide wash for three months, no change.”
      </p>

      <figcaption className="mt-3 text-[10px] text-white/40">
        An example of the brief attached to a booking. Not a real patient.
      </figcaption>
    </figure>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-teal-400/15 px-2.5 py-1 text-[11px] font-semibold text-teal-200">
      {children}
    </span>
  );
}

/**
 * Five days, three colours.
 *
 * The same clinic swatches the real calendar uses, at the size of a thumbnail
 * — enough to say "these are one grid" without pretending to be the grid.
 */
function WeekSketch() {
  const WEEK = [
    ["blue", null],
    ["teal", "blue"],
    ["violet", null],
    ["blue", "teal"],
    [null, "violet"],
  ] as const;

  // Full class strings: Tailwind never sees an interpolated one.
  const DOT: Record<string, string> = {
    blue: "bg-blue-400",
    teal: "bg-teal-400",
    violet: "bg-violet-400",
  };

  return (
    <div
      aria-hidden
      className="hidden shrink-0 gap-1 rounded-xl bg-white/[0.05] p-2 ring-1 ring-inset ring-white/10 sm:flex"
    >
      {WEEK.map((day, i) => (
        <div key={i} className="flex w-4 flex-col gap-1">
          {day.map((slot, j) => (
            <span
              key={j}
              className={`h-4 w-full rounded-sm ${
                slot ? DOT[slot] : "bg-white/[0.07]"
              }`}
            />
          ))}
          {/* Keeps every column the same height whatever it holds. */}
          {day.filter(Boolean).length < 2 && (
            <span className="h-4 w-full rounded-sm bg-white/[0.07]" />
          )}
        </div>
      ))}
    </div>
  );
}

function Small({
  glyph,
  title,
  body,
}: {
  glyph: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-brand-300/40 lg:col-span-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(50,143,240,0.8)]">
        <Glyph name={glyph} />
      </span>
      <h3 className="display-sm mt-4 text-lg text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </article>
  );
}

/** Hand-rolled: three glyphs is not worth a component from a library. */
const PATHS: Record<string, string> = {
  shield: "M12 3l7 3v6c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6zM9 12l2 2 4-4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z",
  rx: "M6 20V9h4a3 3 0 0 1 0 6H6m6 0 5 5M17 15l-5 5",
};

function Glyph({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.shield} />
    </svg>
  );
}
