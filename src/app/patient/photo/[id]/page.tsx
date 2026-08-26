import Link from "next/link";
import { notFound } from "next/navigation";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = {
  title: "What your doctor marked",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * A photograph with the doctor's marks and their treatment plan on it.
 *
 * ── Who can open this ────────────────────────────────────────────────────
 * The person it is a photograph of, and nobody else. Scoped by
 * `patientUserId` in the query rather than checked afterwards, and a
 * photograph belonging to somebody else 404s rather than 403s — whether a
 * picture of a named person exists is itself something only they are entitled
 * to know.
 *
 * ── Why the money is stated so carefully ─────────────────────────────────
 * A figure attached to a photograph of your own face is read as a price you
 * have been given, whatever the small print says. So it says "indicative"
 * three times in three different registers: on each line, on the total, and
 * in a sentence underneath explaining what would change it. This platform
 * removed a financing feature for implying a commitment it could not stand
 * behind, and a marked-up photograph is a far more personal place to imply
 * one.
 *
 * Lines with no price print "on assessment" and are excluded from the total,
 * with the exclusion said out loud. A total that quietly treats an unpriced
 * item as zero is a total that is wrong in the flattering direction.
 */
export default async function SharedPhotoPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser(`/patient/photo/${params.id}`);

  const photo = await prisma.patientPhoto.findFirst({
    where: { id: params.id, patientUserId: user.id },
    select: {
      id: true,
      angle: true,
      capturedAt: true,
      pins: {
        orderBy: { label: "asc" },
        select: {
          id: true,
          x: true,
          y: true,
          label: true,
          treatment: true,
          note: true,
          priceInr: true,
          sessions: true,
          doctor: { select: { name: true } },
        },
      },
    },
  });
  if (!photo) notFound();

  const doctorName = photo.pins[0]?.doctor.name ?? "Your doctor";
  const priced = photo.pins.filter((p) => p.priceInr !== null);
  const total = priced.reduce(
    (n, p) => n + (p.priceInr ?? 0) * (p.sessions ?? 1),
    0
  );
  const unpriced = photo.pins.length - priced.length;

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-surface pb-20 pt-8">
        <div className="container-page max-w-3xl">
          <p className="section-eyebrow">From your doctor</p>
          <h1 className="display mt-2 text-3xl text-ink sm:text-4xl">
            What {doctorName} marked
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Taken{" "}
            {photo.capturedAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . The numbers below are an estimate to help you plan, not a bill and
            not a quote.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
            <div className="relative">
              {/* Served through the signing route, which authorises per
                  request — there is no public URL for a clinical photograph
                  at any point. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/patient-photos/${photo.id}`}
                alt="Your photograph, with your doctor's marks"
                className="block w-full"
              />
              {photo.pins.map((p) => (
                <span
                  key={p.id}
                  className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand-600 text-xs font-black text-white ring-2 ring-white"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {photo.pins.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white/[0.04] p-5 text-sm text-ink-soft ring-1 ring-white/10">
              Your doctor has drawn on this photograph but has not added any
              treatments to it yet. Ask them about it at your next appointment.
            </p>
          ) : (
            <>
              <ul className="mt-6 space-y-2">
                {photo.pins.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-black text-white">
                      {p.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">{p.treatment}</p>
                      {p.note && (
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                          {p.note}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-ink">
                        {p.priceInr === null ? "On assessment" : money(p.priceInr)}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {p.priceInr === null
                          ? "priced after seeing it"
                          : p.sessions
                            ? `indicative, × ${p.sessions} sessions`
                            : "indicative, per session"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Indicative total
                  </span>
                  <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {priced.length === 0 ? "On assessment" : money(total)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  {unpriced > 0 && (
                    <>
                      {unpriced} of {photo.pins.length}{" "}
                      {unpriced === 1 ? "is" : "are"} priced only after your
                      doctor has seen the area in person, so{" "}
                      {unpriced === 1 ? "it is" : "they are"} not in this
                      figure.{" "}
                    </>
                  )}
                  This is what a plan like this usually comes to. It is not a
                  quote and nothing has been booked or charged. What you
                  actually pay depends on what your doctor finds on the day,
                  how many sessions you end up needing, and what you decide to
                  go ahead with.
                </p>
              </div>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/patient/appointments" className="btn-primary">
              Book time to talk it through
            </Link>
            <Link href="/patient/profile#photos" className="btn-ghost">
              All my photographs
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
