"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitApplication } from "@/lib/actions/doctorOnboarding";

export default function SubmitApplication({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const res = await submitApplication();
            if (res.ok) router.refresh();
            else setError(res.error ?? "Could not submit that.");
          })
        }
        className="btn-primary disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit for review"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
