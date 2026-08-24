import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { starters, type Turn } from "@/lib/assistant/core";
import { groundingFor, treatmentVocabulary, type Viewer } from "@/lib/assistant/grounding";
import { answer } from "@/lib/assistant/reply";

/**
 * The assistant's one endpoint.
 *
 * ── The caller never says who it is ──────────────────────────────────────
 * There is no userId, no doctorId and no audience in the request body. All
 * three come from the session, so the worst a crafted request can do is ask
 * a question — it cannot ask it AS somebody else. This is the same reason
 * the plan for the doctor-assist route dropped `applicationGaps`: an endpoint
 * that accepts an arbitrary id is an endpoint that will eventually be handed
 * one.
 *
 * ── History is echoed, not stored ────────────────────────────────────────
 * The client posts its own transcript back. Nothing about a conversation is
 * written to the database: these are questions about skin, asked by name, and
 * the least risky place to keep them is nowhere. It also means the assistant
 * has no memory across reloads, which is the honest trade and is stated in
 * the UI.
 */

export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().trim().min(2).max(500),
  history: z
    .array(
      z.object({
        // Literal tuple, never z.nativeEnum — a stale generated client makes
        // that undefined at runtime and the schema silently accepts anything.
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

async function resolveViewer(): Promise<Viewer> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return { audience: "visitor" };

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    // A doctor account with no practice row yet is treated as a client rather
    // than refused — they can still ask what a treatment is.
    if (doctor) return { audience: "doctor", doctorId: doctor.id };
  }

  return { audience: "patient", userId: user.id };
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ask me something a little longer." }, { status: 400 });
  }

  const viewer = await resolveViewer();

  // Signed-in people are limited per account; everyone else shares a bucket
  // keyed on the forwarded address. Both are per-process, which is the known
  // limitation of this rate limiter across the whole codebase.
  const who =
    viewer.audience === "doctor"
      ? `dr:${viewer.doctorId}`
      : viewer.audience === "patient"
        ? `u:${viewer.userId}`
        : `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;

  const limit = rateLimit(`assistant:${who}`, viewer.audience === "visitor" ? 12 : 40, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        answer: `That is a lot of questions in a short time. Try again in about ${Math.ceil(
          limit.retryAfterSeconds / 60
        )} minute(s), or book a consultation if it is urgent.`,
        source: "deflected",
      },
      { status: 429 }
    );
  }

  const { question, history } = parsed.data;

  const [grounding, vocabulary] = await Promise.all([
    groundingFor(question, viewer),
    treatmentVocabulary(),
  ]);

  const result = await answer(
    question,
    grounding,
    history as Turn[],
    viewer.audience,
    vocabulary
  );

  return NextResponse.json({
    answer: result.answer,
    source: result.source,
    audience: viewer.audience,
  });
}

/** The opening panel: who we think you are, and four things worth asking. */
export async function GET() {
  const viewer = await resolveViewer();
  return NextResponse.json({
    audience: viewer.audience,
    starters: starters(viewer.audience),
  });
}
