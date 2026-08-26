import Link from "next/link";

import {
  Empty,
  Notice,
  PageHead,
  Panel,
  StatTile,
  portalBtnPrimary,
  portalBtnQuiet,
} from "@/components/doctor/portalUi";
import { advisoryGaps, getApplicationGaps } from "@/lib/doctor/gaps";

/**
 * What a practitioner sees while their application is being reviewed.
 *
 * Shows the shape of the dashboard that unlocks on approval, with **nothing
 * invented in it**. The tiles read "—", not a plausible number; there is no
 * greyed-out sample chart. A preview that shows fabricated figures teaches the
 * doctor to distrust the real ones a week later, and this codebase has deleted
 * that kind of thing more than once.
 *
 * The waiting time is also the best moment to polish the listing, so the
 * advisory gaps — the things that do not block approval but make a profile
 * read thin — are offered here rather than left for later.
 */
export default async function PendingPreview({
  doctorId,
  doctorName,
}: {
  doctorId: string;
  doctorName: string;
}) {
  const advisory = advisoryGaps(await getApplicationGaps(doctorId));
  const first = doctorName.replace(/^Dr\.?\s+/i, "").split(" ")[0];

  return (
    <>
      <PageHead
        eyebrow="In review"
        title={`Thanks, ${first}: it's with our team`}
        sub="We check every practitioner's council registration before they go live. It usually takes a couple of working days, and you will get an email either way."
      />

      <div className="mb-7">
        <Notice tone="info" title="What happens next">
          We verify your registration against the council&apos;s register. If
          anything needs changing we will tell you exactly what, and everything
          you have entered stays saved. Once approved you appear in search,
          clients can book you, and this page becomes your dashboard.
        </Notice>
      </div>

      {/* The dashboard's own shape, with no numbers in it yet. */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="Booked this month" value="—" hint="Starts when your first client books" />
        <StatTile label="Clients seen" value="—" hint="Counts from your first completed visit" />
        <StatTile label="Rating" value="—" hint="Appears after your first published review" />
      </div>

      {/*
        The tiles above stay empty on purpose — a preview that fabricates a
        plausible number here teaches a doctor to distrust the real one a week
        later. The walkthrough is where invented figures are allowed, because
        it is behind its own URL, under a banner that says DEMO DATA and does
        not scroll away.

        Offered here because this is the only unhurried time a practitioner
        will ever have with this software: after approval they have a clinic
        to run.
      */}
      <div className="mb-7 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-teal-50/60 p-5">
        <p className="font-bold text-slate-900">
          While you wait, have a look at what you are getting
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          A worked example of a busy month, on the dashboard you will actually
          use, with a short guided walk through the five things worth knowing
          where to find. The figures in it belong to nobody — they are there so
          the charts have a shape to read.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/doctor/portal/demo" className={portalBtnPrimary}>
            See a demo dashboard
          </Link>
          <Link href="/doctor/portal/practice" className={portalBtnQuiet}>
            Check my locations
          </Link>
        </div>
      </div>

      <div className="mb-7">
        <Panel title="Your week" sub="Your calendar unlocks the moment you are approved.">
          <Empty
            icon="calendar"
            title="Nothing booked yet"
            body="Clients cannot find you until your listing is live, so this is empty by design rather than because something is wrong."
          />
        </Panel>
      </div>

      {advisory.length > 0 && (
        <Panel
          title="While you wait"
          sub="None of these hold up your approval. They are what makes a listing worth booking."
        >
          <ul className="space-y-2">
            {advisory.map((g) => (
              <li key={g.key} className="flex items-center gap-2.5 text-sm text-slate-700">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                {g.label}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/doctor/portal/profile" className={portalBtnQuiet}>
              Polish your profile
            </Link>
            <Link href="/doctor/portal?step=1" className={portalBtnQuiet}>
              Review your answers
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}
