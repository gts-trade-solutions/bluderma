import Link from "next/link";

import SmartImage from "@/components/SmartImage";
import { DOCTOR_IMG } from "@/data/doctorImages";

import { doctorCta } from "@/lib/doctor/viewer";

/**
 * Requirement D-6 — the practo-style "simple steps" explainer.
 *
 * Four steps, because that is genuinely how many there are. Padding it to six
 * to look thorough would be the opposite of the point: a clinician deciding
 * whether to spend ten minutes on a form wants to know it is ten minutes.
 */
const STEPS = [
  {
    n: "01",
    img: DOCTOR_IMG.consultRoom,
    title: "Tell us about your practice",
    body: "Your qualifications, where you consult and when. Add as many locations as you work at. Each one keeps its own hours and its own fee.",
  },
  {
    n: "02",
    img: DOCTOR_IMG.examining,
    title: "We check your registration",
    body: "Against your medical council's own register. It is what lets us put a verified mark on your profile and mean it. Usually done within two working days.",
  },
  {
    n: "03",
    img: DOCTOR_IMG.treatmentRoom,
    title: "You go live",
    body: "You appear in search and in the recommendations we make after a client's skin analysis. Matched on what you actually treat, not who paid most.",
  },
  {
    n: "04",
    img: DOCTOR_IMG.treatmentWide,
    title: "Bookings land in your calendar",
    body: "With the client's analysis and questionnaire attached. Confirm each one yourself or let them book straight in, your choice, changeable any time.",
  },
];

export default function SimpleSteps({
  viewer = "guest",
}: {
  /** See JoinHero — the same reasoning, and this was the CTA that missed it. */
  viewer?: "guest" | "client" | "doctor-pending" | "doctor-live" | "admin";
}) {
  const cta = doctorCta(viewer);
  return (
    <section className="scroll-mt-24 border-y border-white/10 bg-white/[0.02] py-20" id="how-it-works">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="section-eyebrow">Getting listed</p>
          <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
            Four steps, about ten minutes
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            You can stop halfway and come back. Everything saves as you go.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="group relative overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-teal-300/40"
            >
              {/* A photograph per step. Four identical text boxes was the
                  same failure the bento above had: nothing to look at, so
                  nothing read. */}
              <div className="relative h-36 overflow-hidden">
                <SmartImage
                  src={s.img}
                  alt=""
                  mode="fill"
                  sizes="(min-width: 1024px) 25vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-[#070d1c]/30 to-transparent"
                />
                <span className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-[var(--scrim)] text-sm font-extrabold text-teal-300 ring-1 ring-inset ring-white/20 backdrop-blur">
                  {s.n}
                </span>
              </div>
              <div className="p-6 pt-5">
                <h3 className="text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Link
            href={cta.href}
            className="btn-primary"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
