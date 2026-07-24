import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema, fieldErrors } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * Self-serve registration. The visitor's entry-modal choice (doctor/patient)
 * becomes the account role — but ONLY doctor or patient, never admin (the zod
 * enum rejects anything else, so the role can't be escalated from the body).
 *
 * Note: a self-registered DOCTOR account gets clinical access immediately. If
 * you want doctor sign-ups gated behind admin verification, add an `approved`
 * flag on the user and check it in isClinician()/the clinical-note route — the
 * admin Users page already exposes role management to reverse a bad signup.
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
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash: await hashPassword(password),
        role: isDoctor ? Role.DOCTOR : Role.PATIENT,
        // Patients get a profile record; doctors are linked to a Doctor
        // directory entry by an admin from /admin/doctors.
        ...(isDoctor
          ? {}
          : {
              patientProfile: {
                create: { fullName: name, phone: phone || null },
              },
            }),
      },
      select: { id: true, email: true },
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
