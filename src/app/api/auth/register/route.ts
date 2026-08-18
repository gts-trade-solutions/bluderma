import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensurePractice } from "@/lib/doctor/ensurePractice";
import { registerSchema, fieldErrors } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * Self-serve registration. The visitor's entry-modal choice (doctor/patient)
 * becomes the account role — but ONLY doctor or patient, never admin (the zod
 * enum rejects anything else, so the role can't be escalated from the body).
 *
 * A DOCTOR registration also creates the draft practice, in the same
 * transaction, so the account is never a login with nothing attached.
 *
 * Doctor sign-ups ARE gated: the practice starts DRAFT and is invisible to
 * clients until an admin approves it at /admin/doctor-applications. See
 * PUBLIC_DOCTOR_WHERE in lib/queries/doctorAccess.ts.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { name, email, phone, password, accountType } = parsed.data;
  const isDoctor = accountType === "doctor";

  try {
    // The login and, for a practitioner, the draft practice are created
    // together. They used not to be: this route made a DOCTOR user and
    // nothing else, so anyone registering here arrived at /doctor/join to be
    // told "no practice record yet" — a dead end for the one person the
    // wizard exists for. One transaction, so a half-made account is not a
    // state the app can end up in.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          passwordHash: await hashPassword(password),
          role: isDoctor ? Role.DOCTOR : Role.PATIENT,
          // Clients get a profile record; practitioners get a practice below.
          ...(isDoctor
            ? {}
            : {
                patientProfile: {
                  create: { fullName: name, phone: phone || null },
                },
              }),
        },
        select: { id: true, email: true, name: true, phone: true },
      });

      if (isDoctor) {
        await ensurePractice(created, tx);
      }
      return created;
    });

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    // P2002 = unique constraint on email. Returning a specific message here is
    // a deliberate trade-off: it confirms the address is registered, but the
    // alternative (silent success) makes the form unusable for honest users
    // who simply forgot they had an account.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          fields: { email: "An account with this email already exists." },
        },
        { status: 409 }
      );
    }

    console.error("register failed", err);
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 }
    );
  }
}
