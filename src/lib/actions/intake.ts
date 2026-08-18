"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Persists a completed "Help us to know you" questionnaire.
 *
 * Anonymous submissions are allowed on purpose — the quiz sits in front of
 * the doctor list and demanding a login there loses the lead — so the row
 * keeps userId null until the same person signs up. Answers are stored as
 * the raw blob (the quiz owns its own schema and it changes); `summary` is
 * derived here so admin lists never have to parse JSON.
 */

const intakeSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export interface IntakeSubmitResult {
  ok: boolean;
  id?: string;
}

export async function submitIntake(input: unknown): Promise<IntakeSubmitResult> {
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const user = await getCurrentUser();

  // Keyed by user when signed in; otherwise one bucket for anonymous churn.
  const limit = rateLimit(
    `intake:${user?.id ?? "anon"}`,
    user ? 10 : 60,
    60 * 60 * 1000
  );
  if (!limit.ok) return { ok: false };

  const a = parsed.data.answers;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const goals = Array.isArray(a.goals) ? (a.goals as unknown[]).join(", ") : "";
  const summary = [str("name"), str("city"), goals]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);

  const row = await prisma.intakeResponse.create({
    data: {
      userId: user?.id ?? null,
      answers: a as object,
      summary: summary || null,
    },
    select: { id: true },
  });

  return { ok: true, id: row.id };
}
