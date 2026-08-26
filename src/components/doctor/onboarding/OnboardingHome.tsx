import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { CLINIC_LIST_SELECT } from "@/lib/queries/clinicSelect";
import { JOIN_STEPS } from "@/data/doctorJoin";
import {
  blockingGaps,
  firstIncompleteStep,
  getApplicationGaps,
} from "@/lib/doctor/gaps";
import { Notice, portalBtnPrimary } from "@/components/doctor/portalUi";
import { aiEnabled } from "@/lib/integrations/aiAssist";
import {
  getSuggestedTreatments,
  getTreatmentVocabulary,
} from "@/lib/queries/treatmentVocabulary";

import AboutStep from "@/components/doctor/join/AboutStep";
import CredentialsStep from "@/components/doctor/join/CredentialsStep";
import ClinicsStep from "@/components/doctor/join/ClinicsStep";
import HoursStep from "@/components/doctor/join/HoursStep";
import ConsultStep from "@/components/doctor/join/ConsultStep";
import ReviewStep from "@/components/doctor/join/ReviewStep";

/**
 * Onboarding, hosted at the portal home.
 *
 * A practitioner used to sign up and land on a marketing page that asked them
 * to list their practice — having just done exactly that. The portal is now
 * where they arrive, and until they are approved the portal IS the
 * application. Same steps, same server actions, same saves: only the frame and
 * the links change, which is why every step component takes its navigation as
 * a prop rather than being forked.
 *
 * Deep links keep working — /doctor/join?step=N redirects here preserving the
 * step — so nothing that was ever sent in an email breaks.
 */

const stepHref = (n: number) => `/doctor/portal?step=${n}`;

export default async function OnboardingHome({
  doctorId,
  requestedStep,
}: {
  doctorId: string;
  /** Raw ?step= from the URL. Absent means "wherever they left off". */
  requestedStep?: string;
}) {
  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: { id: doctorId },
    select: {
      id: true,
      name: true,
      title: true,
      specialty: true,
      experienceYears: true,
      image: true,
      about: true,
      regCouncil: true,
      regNumber: true,
      regYear: true,
      licenceDocUrl: true,
      status: true,
      rejectionReason: true,
      travelBufferMin: true,
      requiresApproval: true,
      modes: { select: { mode: true } },
      languages: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      services: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      specialtyAreas: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      focus: { select: { concern: { select: { key: true } } } },
      otherFocus: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      clinics: CLINIC_LIST_SELECT,
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          clinicId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotMinutes: true,
        },
      },
    },
  });

  const gaps = await getApplicationGaps(doctor.id);
  const blocking = blockingGaps(gaps);
  const rejected = doctor.status === "REJECTED";

  // No explicit step → the earliest one still missing something, so somebody
  // returning after a week is not walked back through screens they finished.
  const requested = Number(requestedStep ?? NaN);
  const step = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), JOIN_STEPS.length - 1)
    : firstIncompleteStep(gaps);

  const ai = aiEnabled();

  // Only loaded for the step that needs them — the vocabulary is ~380 names
  // and there is no reason to ship it while somebody is filling in their
  // qualifications.
  const [concerns, treatmentSuggestions, treatmentVocabulary] =
    step === 5
      ? await Promise.all([
          prisma.skinConcern.findMany({
            where: { isActive: true },
            orderBy: { label: "asc" },
            select: { key: true, label: true },
          }),
          getSuggestedTreatments(),
          getTreatmentVocabulary(),
        ])
      : [[], [], []];

  const meta = JOIN_STEPS[step];
  const pct = Math.round((step / (JOIN_STEPS.length - 1)) * 100);
  // Count STEPS finished, not gaps outstanding: step 1 alone can hold four
  // gaps (name, specialty, photo, description), so subtracting gap count from
  // step count reads "-2 of 6 done" on a brand-new practice.
  const stepsWithWork = new Set(blocking.map((g) => g.step));
  const done = JOIN_STEPS.length - 1 - stepsWithWork.size;

  return (
    <div className="mx-auto max-w-3xl">
      {/* A rejection is the first thing they need to read, above the step. */}
      {rejected && doctor.rejectionReason && !requestedStep && (
        <div className="mb-7">
          <Notice
            tone="warning"
            title="We asked for something to be changed"
            action={
              <Link href={stepHref(firstIncompleteStep(gaps))} className={portalBtnPrimary}>
                Start fixing it
              </Link>
            }
          >
            {doctor.rejectionReason}
          </Notice>
          {blocking.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
              {blocking.map((g) => (
                <li key={g.key} className="text-sm text-slate-700">
                  ·{" "}
                  <Link href={stepHref(g.step)} className="font-semibold underline hover:no-underline">
                    {g.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-7">
        <div className="flex items-end justify-between gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
            Step {step} of {JOIN_STEPS.length - 1}
          </p>
          <p className="text-xs font-semibold text-slate-500">
            {blocking.length === 0
              ? "Everything we need is here"
              : `${done} of ${JOIN_STEPS.length - 1} done`}
          </p>
        </div>
        {/* Same gradient rail the standalone wizard used — full class strings,
            because Tailwind never sees an interpolated one. */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-slate-900 sm:text-3xl">
          {meta.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{meta.sub}</p>
      </div>

      {step === 1 && (
        <AboutStep
          doctor={doctor}
          redirectTo={stepHref(2)}
          cancelHref="/doctor"
          aiEnabled={ai}
        />
      )}
      {step === 2 && (
        <CredentialsStep
          doctor={doctor}
          redirectTo={stepHref(3)}
          cancelHref={stepHref(1)}
        />
      )}
      {step === 3 && (
        <ClinicsStep
          doctor={doctor}
          mode="join"
          nextHref={stepHref(4)}
          backHref={stepHref(2)}
        />
      )}
      {step === 4 && (
        <HoursStep
          doctor={doctor}
          mode="join"
          nextHref={stepHref(5)}
          backHref={stepHref(3)}
        />
      )}
      {step === 5 && (
        <ConsultStep
          doctor={doctor}
          concerns={concerns}
          redirectTo={stepHref(6)}
          cancelHref={stepHref(4)}
          aiEnabled={ai}
          treatmentSuggestions={treatmentSuggestions}
          treatmentVocabulary={treatmentVocabulary}
        />
      )}
      {step === 6 && (
        <ReviewStep
          doctorId={doctor.id}
          status={doctor.status}
          backHref={stepHref(5)}
          stepHref={stepHref}
        />
      )}
    </div>
  );
}
