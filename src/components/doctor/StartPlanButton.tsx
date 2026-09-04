"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import { startTreatmentPlan } from "@/lib/actions/treatmentPlan";

/**
 * Opening a plan for a patient.
 *
 * The action is idempotent per (doctor, patient, scan), so pressing this twice
 * lands on the same plan rather than leaving two half-reviewed drafts for one
 * analysis.
 */
export default function StartPlanButton({
  patientUserId,
  scanId,
}: {
  patientUserId: string;
  /**
   * Optional, because a plan does not need one. startTreatmentPlan has always
   * taken it as a head start rather than a prerequisite — the page used to
   * filter out every patient without one, which is why most doctors found
   * this feature empty.
   */
  scanId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startTreatmentPlan(patientUserId, scanId);
          if (res.ok && res.planId) router.push(`/doctor/portal/plans/${res.planId}`);
        })
      }
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-graphite-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-graphite-700 disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      Review
    </button>
  );
}
