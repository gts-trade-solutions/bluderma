import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { blockingGaps, getApplicationGaps } from "@/lib/doctor/gaps";
import ListedElsewhere from "./ListedElsewhere";
import SubmitApplication from "./SubmitApplication";

/**
 * Step 6 — the check before it goes.
 *
 * The gaps are computed on the server by the same function the submit action
 * uses, so what is listed here is exactly what would block it. A review screen
 * that says "ready" and then a button that refuses is worse than no review
 * screen at all.
 */
export default async function ReviewStep({
  doctorId,
  status,
  backHref = "/doctor/join?step=5",
  stepHref = (n: number) => `/doctor/join?step=${n}`,
}: {
  doctorId: string;
  status: string;
  /** Overridden when the step is hosted inside the portal. */
  backHref?: string;
  stepHref?: (step: number) => string;
}) {
  const [gaps, doctor] = await Promise.all([
    getApplicationGaps(doctorId).then(blockingGaps),
    prisma.doctor.findUniqueOrThrow({
      where: { id: doctorId },
      select: { listedElsewhere: true, listedElsewhereNames: true },
    }),
  ]);

  if (status === "PENDING") {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
        <h2 className="text-lg font-bold text-blue-900">
          Your application is with our team
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-blue-800">
          We check council registration before a practitioner goes live, which
          usually takes a couple of working days. You will get an email either
          way, and you can keep editing your profile in the meantime.
        </p>
        <Link href="/doctor/portal" className="btn-primary mt-5 inline-flex">
          Go to your portal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {gaps.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-900">
            {gaps.length === 1 ? "One thing is" : `${gaps.length} things are`} still
            missing
          </p>
          <ul className="mt-2 space-y-1">
            {gaps.map((g) => (
              <li key={g.key} className="text-sm text-amber-800">
                ·{" "}
                <Link href={stepHref(g.step)} className="underline hover:no-underline">
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-700">
            Use the steps above to fill them in. Everything you have entered is
            already saved.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="font-bold text-teal-900">Everything we need is here</p>
          <p className="mt-1 text-sm text-teal-800">
            Send it over and we will check your registration details. You will
            hear from us either way.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p className="font-bold text-slate-900">What happens next</p>
        <ol className="mt-2 space-y-1.5">
          <li>1. We verify your registration against the council&apos;s register.</li>
          <li>2. If anything needs changing, we tell you what and you resubmit.</li>
          <li>
            3. Once approved you appear in search, clients can book you, and your
            calendar goes live.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Until then your profile is not visible to anyone outside our team.
        </p>
      </div>

      {/* Asked last, and never required. See ListedElsewhere.tsx. */}
      <ListedElsewhere
        defaultAnswer={doctor.listedElsewhere}
        defaultNames={doctor.listedElsewhereNames ?? ""}
      />

      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <SubmitApplication disabled={gaps.length > 0} />
        <Link href={backHref} className="btn-ghost">
          Back
        </Link>
      </div>
    </div>
  );
}
