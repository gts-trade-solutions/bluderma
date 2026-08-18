import Link from "next/link";

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
    title: "Tell us about your practice",
    body: "Your qualifications, where you consult and when. Add as many locations as you work at — each one keeps its own hours and its own fee.",
  },
  {
    n: "02",
    title: "We check your registration",
    body: "Against your medical council's own register. It is what lets us put a verified mark on your profile and mean it. Usually done within two working days.",
  },
  {
    n: "03",
    title: "You go live",
    body: "You appear in search and in the recommendations we make after a client's skin analysis — matched on what you actually treat, not who paid most.",
  },
  {
    n: "04",
    title: "Bookings land in your calendar",
    body: "With the client's analysis and questionnaire attached. Confirm each one yourself or let them book straight in — your choice, changeable any time.",
  },
];

export default function SimpleSteps({
  viewer = "guest",
}: {
  /** See JoinHero — the same reasoning, and this was the CTA that missed it. */
  viewer?: "guest" | "client" | "doctor-pending" | "doctor-live" | "admin";
}) {
  const live = viewer === "doctor-live" || viewer === "admin";
  return (
    <section className="scroll-mt-24 bg-slate-50 py-20" id="how-it-works">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="section-eyebrow">Getting listed</p>
          <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            Four steps, about ten minutes
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            You can stop halfway and come back — everything saves as you go.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="relative rounded-2xl bg-white p-6 ring-1 ring-slate-200"
            >
              <span className="text-sm font-bold tracking-widest text-brand-600">
                {s.n}
              </span>
              <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Link
            href={live ? "/doctor/portal" : "/doctor/join"}
            className="btn-primary"
          >
            {live
              ? "Open your portal"
              : viewer === "doctor-pending"
              ? "Finish your listing"
              : "Start your listing"}
          </Link>
        </div>
      </div>
    </section>
  );
}
