"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateOwnAppointmentStatus } from "@/lib/actions/doctor";

/**
 * Per-appointment status buttons for the doctor's own list. Complete / no-show
 * for past visits, cancel for upcoming ones.
 */
export default function AppointmentActions({
  appointmentId,
  upcoming,
}: {
  appointmentId: string;
  upcoming: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(status: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateOwnAppointmentStatus(appointmentId, status);
      if (!res.ok) {
        setError(res.error ?? "Could not update.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        {upcoming ? (
          <button
            onClick={() => run("CANCELLED")}
            disabled={pending}
            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              onClick={() => run("COMPLETED")}
              disabled={pending}
              className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              Completed
            </button>
            <button
              onClick={() => run("NO_SHOW")}
              disabled={pending}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-ink-muted transition hover:bg-slate-50 disabled:opacity-50"
            >
              No-show
            </button>
          </>
        )}
      </div>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}
