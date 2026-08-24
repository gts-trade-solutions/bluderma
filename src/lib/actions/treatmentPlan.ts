"use server";

import { revalidatePath } from "next/cache";
import { PlanItemSource, PlanItemState } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { getTreatmentVocabulary } from "@/lib/queries/treatmentVocabulary";
import { aiEnabled } from "@/lib/integrations/aiAssist";
import {
  buildPrompt,
  parseSuggestions,
  rankedConcerns,
  templateSuggestions,
  type ScanIssue,
  type Suggestion,
} from "@/lib/integrations/treatmentPlanCore";
import type { ActionResult } from "./enquiry";

/**
 * Building a treatment plan from a patient's skin analysis.
 *
 * The AI proposes; the doctor disposes. Every suggestion is stored SUGGESTED
 * and stays invisible to the patient until the doctor both accepts lines and
 * shares the plan. Two separate acts, deliberately: accepting a treatment is a
 * clinical judgement, releasing a plan is a communication, and conflating them
 * is how a half-finished draft reaches somebody's phone.
 */

/** Model call kept here; the rules it obeys live in treatmentPlanCore. */
async function askModel(
  concerns: ScanIssue[],
  vocabulary: string[]
): Promise<{ items: Suggestion[]; source: "ai" | "template" }> {
  const template = () => ({
    items: templateSuggestions(concerns, vocabulary),
    source: "template" as const,
  });
  if (!aiEnabled() || !concerns.length || !vocabulary.length) return template();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(concerns, vocabulary) }],
      }),
      // A doctor is waiting on this screen. Better a template answer promptly
      // than a better one they have already navigated away from.
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return template();
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return template();

    const items = parseSuggestions(raw, vocabulary);
    return items.length ? { items, source: "ai" } : template();
  } catch {
    return template();
  }
}

/**
 * Create a plan for a patient, seeded from their most recent analysis.
 *
 * Idempotent per (doctor, patient, scan): opening the screen twice must not
 * leave a doctor with two half-reviewed plans for the same scan.
 */
export async function startTreatmentPlan(
  patientUserId: string,
  scanId?: string
): Promise<ActionResult & { planId?: string }> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const existing = await prisma.treatmentPlan.findFirst({
    where: { doctorId: owner.doctorId, patientUserId, scanId: scanId ?? null },
    select: { id: true },
  });
  if (existing) return { ok: true, planId: existing.id };

  // Only from a scan that is actually this patient's. A scanId in the payload
  // is an assertion by the caller, not a fact.
  const scan = scanId
    ? await prisma.skinScan.findFirst({
        where: { id: scanId, userId: patientUserId },
        select: { id: true, issues: { select: { issueType: true, score: true, severityBand: true } } },
      })
    : null;
  if (scanId && !scan) return { ok: false, error: "That analysis is not this patient's." };

  const concerns = rankedConcerns(scan?.issues ?? []);
  const vocabulary = await getTreatmentVocabulary();
  const { items } = await askModel(concerns, vocabulary);

  try {
    const plan = await prisma.treatmentPlan.create({
      data: {
        doctorId: owner.doctorId,
        patientUserId,
        scanId: scan?.id ?? null,
        items: {
          create: items.map((s, i) => ({
            treatment: s.treatment,
            rationale: s.rationale || null,
            source: PlanItemSource.AI,
            // Never ACCEPTED on creation. The doctor decides.
            state: PlanItemState.SUGGESTED,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    revalidatePath("/doctor/portal/plans");
    return { ok: true, planId: plan.id };
  } catch {
    return { ok: false, error: "Could not start that plan." };
  }
}

const itemSchema = z.object({
  planId: z.string().min(1),
  treatment: z.string().trim().min(2, "Name the treatment.").max(160),
  rationale: z.string().trim().max(500).optional().default(""),
});

/** The doctor adding something the analysis did not propose. */
export async function addPlanItem(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Name the treatment." };
  const d = parsed.data;

  const plan = await mine(owner.doctorId, d.planId);
  if (!plan) return { ok: false, error: "That plan is not yours." };

  const count = await prisma.treatmentPlanItem.count({ where: { planId: d.planId } });
  await prisma.treatmentPlanItem.create({
    data: {
      planId: d.planId,
      treatment: d.treatment,
      rationale: d.rationale || null,
      // A doctor's own line is ACCEPTED on arrival: they would not have typed
      // it to then approve it, and making them click twice is friction with no
      // safety behind it.
      source: PlanItemSource.DOCTOR,
      state: PlanItemState.ACCEPTED,
      sortOrder: count,
    },
  });

  revalidatePath(`/doctor/portal/plans/${d.planId}`);
  return { ok: true };
}

export async function setPlanItemState(
  itemId: string,
  state: PlanItemState
): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  // The ownership check reaches through the plan: an item id alone says
  // nothing about whose patient it concerns.
  const res = await prisma.treatmentPlanItem.updateMany({
    where: { id: itemId, plan: { doctorId: owner.doctorId } },
    data: { state },
  });
  if (res.count === 0) return { ok: false, error: "That item is not yours." };

  revalidatePath("/doctor/portal/plans");
  return { ok: true };
}

export async function sharePlan(planId: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: planId, doctorId: owner.doctorId },
    select: { id: true, items: { where: { state: PlanItemState.ACCEPTED }, select: { id: true } } },
  });
  if (!plan) return { ok: false, error: "That plan is not yours." };
  if (plan.items.length === 0) {
    // A plan with nothing accepted says only "your doctor looked and chose
    // nothing", which is not what sharing it is meant to communicate.
    return { ok: false, error: "Accept at least one treatment before sharing this." };
  }

  await prisma.treatmentPlan.update({
    where: { id: planId },
    data: { sharedAt: new Date() },
  });
  revalidatePath("/patient/profile");
  revalidatePath(`/doctor/portal/plans/${planId}`);
  return { ok: true };
}

/** Withdraw a shared plan. The patient stops seeing it immediately. */
export async function unsharePlan(planId: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.treatmentPlan.updateMany({
    where: { id: planId, doctorId: owner.doctorId },
    data: { sharedAt: null },
  });
  if (res.count === 0) return { ok: false, error: "That plan is not yours." };

  revalidatePath("/patient/profile");
  revalidatePath(`/doctor/portal/plans/${planId}`);
  return { ok: true };
}

async function mine(doctorId: string, planId: string) {
  return prisma.treatmentPlan.findFirst({
    where: { id: planId, doctorId },
    select: { id: true },
  });
}
